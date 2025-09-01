import { GoogleGenerativeAI } from "@google/generative-ai";
import nodemailer from "nodemailer";

export default async function handler(req, res) {
  try {
    const serpApiKey = process.env.SERPAPI_KEY;
    const geminiApiKey = process.env.GOOGLE_AI_API_KEY;

    if (!serpApiKey) {
      return res.status(500).json({ error: "Missing SerpAPI key" });
    }

    // ✅ Wrap fetch URL in backticks
    const response = await fetch(
      `https://serpapi.com/search.json?engine=google_jobs&q=Scrum+Master+OR+Project+Manager+OR+Program+Manager+OR+Technical+Project+Manager&location=Bangalore,+Karnataka,+India&api_key=${serpApiKey}`
    );

    if (!response.ok) {
      throw new Error("Failed to fetch jobs from SerpAPI");
    }

    const data = await response.json();

    if (!data.jobs_results) {
      return res.status(500).json({ error: "No job results found" });
    }

    // ✅ Filter only LinkedIn + Glassdoor, posted within 30 days
    const jobs = data.jobs_results
      .filter(
        (job) =>
          job.via &&
          (job.via.toLowerCase().includes("linkedin") ||
            job.via.toLowerCase().includes("glassdoor"))
      )
      .filter((job) => {
        const posted = job.detected_extensions?.posted_at || "";
        return (
          posted.includes("day") &&
          !posted.includes("30+")
        );
      })
      .map((job) => ({
        title: job.title,
        company: job.company_name,
        location: job.location,
        date: job.detected_extensions?.posted_at || "N/A",
        source: job.via,
        link: job.apply_options?.[0]?.link || `https://www.google.com/search?q=${job.job_id}`,
      }));

    let aiAnalysis = "AI analysis not available.";
    if (geminiApiKey && jobs.length > 0) {
      const genAI = new GoogleGenerativeAI(geminiApiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const prompt = `Summarize the following ${jobs.length} jobs in Bangalore from LinkedIn and Glassdoor (Scrum Master, Project Manager, Program Manager). Only jobs not older than 30 days should be considered. Provide company, role, and hyperlink per line:\n\n${JSON.stringify(jobs, null, 2)}`;

      const aiResponse = await model.generateContent(prompt);
      aiAnalysis = aiResponse.response.text(); // ✅ Correct extraction
    }

    // ✅ Gmail transport (requires Gmail App Password)
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
      message: "Jobs fetched & emailed successfully!",
      jobs,
      summary: aiAnalysis,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("❌ Job Agent Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}
