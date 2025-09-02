import { GoogleGenerativeAI } from "@google/generative-ai";
import nodemailer from "nodemailer";

export default async function handler(req, res) {
  try {
    const serpApiKey = process.env.SERPAPI_KEY;
    const geminiApiKey = process.env.GOOGLE_AI_API_KEY;
    const jsearchApiKey = process.env.JSEARCH_API_KEY;

    let serpJobs = [];
    let jsearchJobs = [];
    let nextPageToken = null;

    // ========== Fetch from SerpAPI ==========
    if (serpApiKey) {
          try {
            for (let page = 0; page < 3; page++) { // fetch up to 3 pages
              const url = new URL("https://serpapi.com/search.json");
              url.searchParams.set("engine", "google_jobs");
              url.searchParams.set(
                "q",
                "Scrum Master OR Project Manager OR Program Manager OR Technical Project Manager"
              );
              url.searchParams.set("location", "Bangalore, India");
              url.searchParams.set("api_key", serpApiKey);
              if (nextPageToken) url.searchParams.set("next_page_token", nextPageToken);

              const response = await fetch(url);
              if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`SerpAPI Error ${response.status}: ${errorText}`);
              }

              const data = await response.json();
              serpJobs.push(
                ...(data.jobs_results || []).map((job) => ({
                  title: job.title,
                  company: job.company_name,
                  location: job.location,
                  date: job.detected_extensions?.posted_at || "N/A",
                  source: job.via || "Google Jobs",
                  link:
                    job.apply_options?.[0]?.link ||
                    `https://www.google.com/search?q=${job.job_id}`,
                }))
              );

              // stop if no next page
              if (!data.serpapi_pagination?.next_page_token) break;
              nextPageToken = data.serpapi_pagination.next_page_token;

              // API recommends small delay before next call (to allow token activation)
              await new Promise((r) => setTimeout(r, 2000));
            }
          } catch (e) {
            console.warn("⚠️ SerpAPI fetch failed:", e.message);
          }
//      try {
//        for (let start = 0; start < 30; start += 10) {
//          const url = `https://serpapi.com/search.json?engine=google_jobs&q=Scrum+Master+OR+Project+Manager+OR+Program+Manager+OR+Technical+Project+Manager&location=Bangalore,+India&api_key=${serpApiKey}&start=${start}`;
//          const response = await fetch(url);
//
//          if (!response.ok) {
//            const errorText = await response.text();
//            throw new Error(`SerpAPI Error ${response.status}: ${errorText}`);
//          }
//
//          const data = await response.json();
//          serpJobs.push(
//            ...(data.jobs_results || []).map((job) => ({
//              title: job.title,
//              company: job.company_name,
//              location: job.location,
//              date: job.detected_extensions?.posted_at || "N/A",
//              source: job.via || "Google Jobs",
//              link:
//                job.apply_options?.[0]?.link ||
//                `https://www.google.com/search?q=${job.job_id}`,
//            }))
//          );
//        }
//      } catch (e) {
//        console.warn("⚠️ SerpAPI fetch failed:", e.message);
//      }
    }

    // ========== Fetch from JSearch ==========
    if (jsearchApiKey) {
      try {
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

        if (!jsearchResponse.ok) {
          const errorText = await jsearchResponse.text();
          throw new Error(`JSearch Error ${jsearchResponse.status}: ${errorText}`);
        }

        const jsearchData = await jsearchResponse.json();
        jsearchJobs = (jsearchData.data || []).map((job) => ({
          title: job.job_title,
          company: job.employer_name,
          location: job.job_city || job.job_location || "N/A",
          date: job.job_posted_at || "N/A",
          source: job.job_publisher || "JSearch",
          link: job.job_apply_link || job.job_google_link,
        }));
      } catch (e) {
        console.warn("⚠️ JSearch fetch failed:", e.message);
      }
    }

    // ========== Combine, Relaxed Location & Deduplicate ==========
//    const allowedLocations = [
//      "Bangalore",
//      "Bengaluru",
//      "Karnataka",
//      "Bangalore urban",
//    ];
    console.log("Raw SerpAPI jobs:", serpJobs.length);
    console.log("Raw JSearch jobs:", jsearchJobs.length);

    const finalJobs = [...serpJobs, ...jsearchJobs];
//      const loc = (job.location || "").toLowerCase();
//      return allowedLocations.some((city) => loc.includes(city));


    console.log("After joining both feeds:", finalJobs.length);
//    const seen = new Set();
//    const allJobs = allJobsRaw.filter((job) => {
//      const key = `${job.title}|${job.company}|${job.location}`.toLowerCase();
//      if (seen.has(key)) return false;
//      seen.add(key);
//      return true;
//    });

    // Keep at least 10 jobs (slice top 15 if more)
    //const finalJobs = allJobs;

    if (finalJobs.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No jobs found (both APIs returned empty).",
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

        const prompt = `
        You are an analyst. You are given ${finalJobs.length} recent Bangalore job postings (JSON array).
        Each item has: title, company, location, date, source, link, and may or may not include salary/compensation fields.

        TASKS (use ONLY the provided data; do not invent facts):
        1) Brief Summary (3–5 bullets): what roles, seniority mix, and hiring momentum you observe.
        2) Role Mix & Skills:
           - Count by role buckets: Scrum Master, Project Manager, Program Manager, Technical Project Manager, Other.
           - List recurring required skills/keywords you detect in titles (and if present, descriptions), e.g., Agile, Scrum, Jira, SAFe, Cloud, Data, AI/ML, Stakeholder mgmt.
        3) Trend Analysis (Bangalore, last 30 days in this dataset):
           - Notable themes (e.g., agile at scale, cloud/data programs, digital transformation).
           - Seniority tilt (junior/mid/senior) inferred from titles.
           - Source split (LinkedIn vs Glassdoor) and any company clusters.
        4) Compensation Insight (₹ INR):
           - From postings that include any pay info (fields like salary, compensation, pay, CTC if present in text), extract min/max and compute simple averages.
           - Report: number of postings with pay info, avg (and low–high) by role bucket if possible.
           - If NO postings include pay info, clearly state: "Compensation not specified in these postings."
           - Do NOT guess pay for companies without explicit figures in the data.
        5) Best Companies in Bangalore (from THIS dataset):
           - Top employers by frequency (top 5–10). Show counts.
        6) Curated List:
           - Provide a concise, copy-ready list: "Company — Role — Link" (one per line; hyperlink the link).

        OUTPUT FORMAT (Markdown):
        ## Summary
        • ...

        ## Role Mix & Skills
        - Counts: ...
        - Skills: ...

        ## Trends
        - ...

        ## Compensation (₹ INR, based on provided postings only)
        - Postings with pay info: X of ${finalJobs.length}
        - Overall: avg ₹A (low ₹L – high ₹H)
        - By role (if available): Scrum Master ₹..., Project Manager ₹..., Program Manager ₹..., Technical PM ₹...

        ## Best Companies (by count in this dataset)
        1) Company — N
        ...

        ## Job List
        - [Company — Role] (Link)

        DATA:
        ${JSON.stringify(finalJobs, null, 2)}
        `;


        const aiResponse = await model.generateContent(prompt);
        aiAnalysis = aiResponse.response.text();
      } catch (e) {
        console.warn("⚠️ Gemini summarization failed:", e.message);
      }
    }

    // ========== Email ==========
    const jobListHtml = finalJobs
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
      subject: "Latest Jobs in PM/Scrum Master role - Bangalore",
      html: `<h3>Job Report</h3><ul>${jobListHtml}</ul><ul>${aiAnalysis}</ul>`,
    });

    // ========== Response ==========
    res.status(200).json({
      success: true,
      message: `Jobs fetched from ${
        serpJobs.length && jsearchJobs.length
          ? "SerpAPI + JSearch"
          : serpJobs.length
          ? "SerpAPI only"
          : "JSearch only"
      }, filtered to Bangalore, deduped & emailed successfully!`,
      jobs: finalJobs,
      summary: aiAnalysis,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("❌ Job Agent Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}
