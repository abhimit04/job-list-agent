import { GoogleGenerativeAI } from "@google/generative-ai";
import nodemailer from "nodemailer";

export default async function handler(req, res) {
  try {
    const serpApiKey = process.env.SERPAPI_KEY;
    const geminiApiKey = process.env.GOOGLE_AI_API_KEY;
    const jsearchApiKey = process.env.JSEARCH_API_KEY;

    if (!serpApiKey || !jsearchApiKey) {
      return res.status(500).json({ error: "Missing API keys" });
    }

    // ========== Fetch from SerpAPI (3 pages) ==========
    const serpJobs = [];
    for (let start = 0; start < 30; start += 10) {
      const response = await fetch(
        `https://serpapi.com/search.json?engine=google_jobs&q=Scrum+Master+OR+Project+Manager+OR+Program+Manager+OR+Technical+Project+Manager&location=Bangalore,+Karnataka,+India&api_key=${serpApiKey}&start=${start}`
      );

      if (!response.ok) throw new Error("Failed to fetch jobs from SerpAPI");
      const data = await response.json();
      serpJobs.push(
        ...(data.jobs_results || [])
          .filter(
            (job) =>
              job.via &&
              (job.via.toLowerCase().includes("linkedin") ||
                job.via.toLowerCase().includes("glassdoor"))
          )
          .filter((job) => {
            const posted = job.detected_extensions?.posted_at?.toLowerCase() || "";
            return (
              posted.includes("hour") ||
              posted.includes("just") ||
              (posted.includes("day") && !posted.includes("14+"))
            );
          })
          .map((job) => ({
            title: job.title,
            company: job.company_name,
            location: job.location,
            date: job.detected_extensions?.posted_at || "N/A",
            source: job.via,
            link:
              job.apply_options?.[0]?.link ||
              `https://www.google.com/search?q=${job.job_id}`,
          }))
      );
    }

    // ========== Fetch from JSearch (3 pages) ==========
    const jsearchResponse = await fetch(
      `https://jsearch.p.rapidapi.com/search?query=Scrum+Master+OR+Project+Manager+OR+Program+Manager+OR+Technical+Project+Manager&location=Bangalore,+India&page=1&num_pages=5`,
      {
        method: "GET",
        headers: {
          "X-RapidAPI-Key": jsearchApiKey,
          "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
        },
      }
    );

    if (!jsearchResponse.ok) throw new Error("Failed to fetch jobs from JSearch");
    const jsearchData = await jsearchResponse.json();

    const jsearchJobs = (jsearchData.data || [])
      .filter(
        (job) =>
          job.job_publisher &&
          (job.job_publisher.toLowerCase().includes("linkedin") ||
            job.job_publisher.toLowerCase().includes("glassdoor"))
      )
      .filter((job) => {
        const posted = job.job_posted_at || "";
        return (
          posted.toLowerCase().includes("hour") ||
          posted.toLowerCase().includes("just") ||
          (posted.toLowerCase().includes("day") &&
            !posted.toLowerCase().includes("30+"))
        );
      })
      .map((job) => ({
        title: job.job_title,
        company: job.employer_name,
        location: job.job_city || job.job_location || "N/A",
        date: job.job_posted_at || "N/A",
        source: job.job_publisher,
        link: job.job_apply_link || job.job_google_link,
      }));

    // ========== Combine, Filter by Location & Deduplicate ==========
    const allowedLocations = ["bangalore", "bengaluru"];

    const allJobsRaw = [...serpJobs, ...jsearchJobs].filter((job) => {
      const loc = (job.location || "").toLowerCase();
      return allowedLocations.some((city) => loc.includes(city));
    });

    const seen = new Set();
    const allJobs = allJobsRaw.filter((job) => {
      const key = `${job.title}|${job.company}|${job.location}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    if (allJobs.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No new jobs found in the last 30 days.",
        jobs: [],
        summary: "No jobs to report.",
        timestamp: new Date().toISOString(),
      });
    }

    // ========== AI Summarization ==========
    let aiAnalysis = "AI analysis not available.";
    if (geminiApiKey) {
      try {
        const genAI = new GoogleGenerativeAI(geminiApiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `Summarize the following ${allJobs.length} jobs in Bangalore from LinkedIn and Glassdoor (Scrum Master, Project Manager, Program Manager). Only jobs not older than 30 days should be considered. Provide company, role, and hyperlink per line:\n\n${JSON.stringify(
          allJobs,
          null,
          2
        )}`;

        const aiResponse = await model.generateContent(prompt);
        aiAnalysis = aiResponse.response.text();
      } catch (e) {
        console.warn("⚠️ Gemini summarization failed:", e.message);
      }
    }

    // ========== Email ==========
    const jobListHtml = allJobs
      .map(
        (job) =>
          `<li><b>${job.title}</b> at ${job.company} (${job.date})
          - <a href="${job.link}" target="_blank">${job.source}</a></li>`
      )
      .join("");

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: `"AI Job Agent" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_TO,
      subject: "Latest Job Report - Bangalore",
      html: `<h3>AI Job Report</h3><p>${aiAnalysis}</p><ul>${jobListHtml}</ul>`,
    });

    // ========== Response ==========
    res.status(200)
