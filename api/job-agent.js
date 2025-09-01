import { GoogleGenerativeAI } from "@google/generative-ai";
import nodemailer from "nodemailer";

export default async function handler(req, res) {
  try {
    const serpApiKey = process.env.SERPAPI_KEY;
    const geminiApiKey = process.env.GOOGLE_AI_API_KEY;

    if (!serpApiKey) {
      return res.status(500).json({ error: "Missing SerpAPI key" });
    }

    let jobs = [];
    let start = 0;

    // keep fetching until we have 20 LinkedIn + Glassdoor jobs OR max 5 pages (~50 jobs)
    while (jobs.length < 20 && start < 50) {
      const response = await fetch(
        `https://serpapi.com/search.json?engine=google_jobs&q=Scrum+Master+OR+Project+Manager+OR+Program+Manager+OR+Technical+Project+Manager&location=Bangalore,+Karnataka,+India&start=${start}&api_key=${serpApiKey}`
      );

      if (!response.ok) throw new Error("Failed to fetch jobs from SerpAPI");

      const data = await response.json();

      if (!data.jobs_results || data.jobs_results.length === 0) break;

      const filtered = data.jobs_results
        .filter(job =>
          job.via &&
          (job.via.toLowerCase().includes("linkedin") ||
           job.via.toLowerCase().includes("glassdoor"))
        )
        .filter(job => job.detected_extensions?.posted_at) // has posting info
        .map(job => ({
          title: job.title,
          company: job.company_name,
          location: job.location,
          date: job.detected_extensions?.posted_at || "N/A",
          source: job.via,
          link: job.apply_options?.[0]?.link || job.job_id,
        }));

      jobs = jobs.concat(filtered);

      start += 10; // move to next page
    }

    // trim to exactly 20
    jobs = jobs.slice(0, 20);

    // 🔹 Gemini AI Summary
    let aiAnalysis = "AI analysis not available.";
    if (geminiApiKey && jobs.length > 0) {
      const genAI = new GoogleGenerativeAI(geminiApiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const prompt = `Analyze the following ${jobs.length} jobs in Bangalore only from LinkedIn and Glassdoor for Scrum Master, Project Manager, Program Manager roles. Summarize skills, salary patterns, demand trends, and provide job titles with company names:\n\n${JSON.stringify(jobs, null, 2)}`;

      const aiResponse = await model.generateContent(prompt);
      aiAnalysis = aiResponse.response;
    }

    // 🔹 Gmail send
    let transporter = nodemailer.createTransport({
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
      html: `<h3>AI Job Report</h3><p>${aiAnalysis}</p>`,
    });

    res.status(200).json({
      success: true,
      message: "20 jobs fetched & emailed successfully!",
      count: jobs.length,
      jobs,
      summary: aiAnalysis,
    });

  } catch (err) {
    console.error("❌ Job Agent Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}
