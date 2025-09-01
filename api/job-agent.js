import { GoogleGenerativeAI } from "@google/generative-ai";
import nodemailer from "nodemailer";

export default async function handler(req, res) {
  try {
    // STEP 1: Mock jobs / API jobs (replace with SerpAPI later)
    const serpApiKey = process.env.SERPAPI_KEY;
        //const geminiApiKey = process.env.GEMINI_API_KEY;

        if (!serpApiKey) {
          return res.status(500).json({ error: "Missing SerpAPI key" });
        }

        // Fetch latest jobs from SerpAPI
        const response = await fetch(
          `https://serpapi.com/search.json?engine=google_jobs&q=Scrum+Master+OR+Project+Manager+OR+Program+Manager+OR+Technical+Project+Manager&location=Bangalore,+Karnataka,+India&api_key=${serpApiKey}`
        );

        const data = await response.json();

        if (!data.jobs_results) {
          return res.status(500).json({ error: "No job results found" });
        }

        const jobs = data.jobs_results
          .filter(job => job.detected_extensions?.posted_at) // ensure job has a posted date
          .map(job => ({
            title: job.title,
            company: job.company_name,
            location: job.location,
            date: job.detected_extensions?.posted_at || "N/A",
            link: job.apply_options?.[0]?.link || job.job_id,
          }));

    // STEP 2: AI summary using Gemini (Free tier)
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt =
    `Summarize these ${jobs.length} jobs in Bangalore into a concise report with company, role,
    and new job in new line with hyperlink:\n\n${JSON.stringify(jobs)};
     Provide concise insights:
     1. Market trends (2 sentences)
     2. Salary insights
     3. Top 5 in-demand skills
     4. Best opportunities by experience level
     5. Quick tips for applicants

     Keep under 250 words

    const aiResponse = await model.generateContent(prompt);
    const summary = aiResponse.response.text();

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
