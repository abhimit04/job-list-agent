import { GoogleGenerativeAI } from "@google/generative-ai";
import nodemailer from "nodemailer";

export default async function handler(req, res) {
  try {
    // STEP 1: Mock jobs / API jobs (replace with SerpAPI later)
    const jobs = [
      {
        title: "Scrum Master",
        company: "Razorpay",
        url: "https://linkedin.com/jobs/view/1234567"
      },
      {
        title: "Project Manager",
        company: "Flipkart",
        url: "https://linkedin.com/jobs/view/2345678"
      }
    ];

    // STEP 2: AI summary using Gemini (Free tier)
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `Summarize these ${jobs.length} jobs in Bangalore into a concise report with company, role, and hyperlink:\n\n${JSON.stringify(jobs)}`;
    const aiResponse = await model.generateContent(prompt);
    const summary = aiResponse.response.text();

    // STEP 3: Setup Gmail transport
    let transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,   // your gmail address
        pass: process.env.GMAIL_PASS    // app password
      }
    });

    // STEP 4: Send mail
    await transporter.sendMail({
      from: `"AI Job Agent" <${process.env.GMAIL_USER}>`,
      to: process.env.TARGET_EMAIL,  // your recipient email
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
