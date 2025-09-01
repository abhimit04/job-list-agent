import { GoogleGenerativeAI } from "@google/generative-ai";
import nodemailer from "nodemailer";

export default async function handler(req, res) {
  try {
    // STEP 1: Mock jobs / API jobs (replace with SerpAPI later)
    const serpApiKey = process.env.SERPAPI_KEY;
    const geminiApiKey = process.env.GOOGLE_AI_API_KEY;

    if (!serpApiKey) {
          return res.status(500).json({ error: "Missing SerpAPI key" });
    }

        // Fetch latest jobs from SerpAPI
    const response = await fetch(
    https://serpapi.com/search.json?engine=google_jobs&q=Scrum+Master+OR+Project+Manager+OR+Program+Manager+OR+Technical+Project+Manager&location=Bangalore,+Karnataka,+India&api_key=${serpApiKey}`
    );
    if (!response.ok) {
              throw new Error("Failed to fetch jobs from SerpAPI");
    }

    const data = await response.json();

    if (!data.jobs_results) {
          return res.status(500).json({ error: "No job results found" });
    }

         // 🔎 Filter only LinkedIn + Glassdoor
    const jobs = data.jobs_results
              .filter(job =>
                job.via &&
                (job.via.toLowerCase().includes("linkedin") ||
                 job.via.toLowerCase().includes("glassdoor"))
              )
              .filter(job => job.detected_extensions?.posted_at) // ensure recent posting info
              .map(job => ({
                title: job.title,
                company: job.company_name,
                location: job.location,
                date: job.detected_extensions?.posted_at || "N/A",
                source: job.via,
                link: job.apply_options?.[0]?.link || job.job_id,
              }));

     let aiAnalysis = "AI analysis not available.";
     if (geminiApiKey && jobs.length > 0) {
          const genAI = new GoogleGenerativeAI(geminiApiKey);
          const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

          const prompt = `Analyze the following ${jobs.length} jobs in Bangalore only from LinkedIn and Glassdoor for Scrum Master, Project Manager, Program Manager roles. Do not consider jobs which are 30 day old or more. Summarize key skills, salary patterns, and demand trends:\n\n${JSON.stringify(
            jobs,
            null,
            2
          )}`;
    // STEP 2: AI summary using Gemini (Free tier)
//    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
//    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
//    const prompt =
//    `Summarize these ${jobs.length} jobs in Bangalore into a concise report with company, role,
//    and new job in new line with hyperlink:\n\n${JSON.stringify(jobs)}`;

    const aiResponse = await model.generateContent(prompt);
    const summary = aiResponse.response.text();
    }
    // STEP 3: Setup Gmail transport
    let transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,   // your gmail address
        pass: process.env.EMAIL_PASS    // app password
      }
    });

    // STEP 4: Send mail
    await transporter.sendMail({
      from: `"AI Job Agent" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_TO,  // your recipient email
      subject: "Latest Job Report - Bangalore",
      html: `<h3>AI Job Report</h3><p>${summary}</p>`
    });

    // STEP 5: Respond to frontend
    res.status(200).json({
      success: true,
      message: "Jobs fetched & emailed successfully!",
      jobs,
      summary
    });

  } catch (err) {
    console.error("❌ Job Agent Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}
