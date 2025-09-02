# 🤖 AI Job Agent

AI-powered job aggregation tool that fetches the latest openings in **Bangalore, India** from **SerpAPI** and **JSearch**, filters & deduplicates them, generates an **AI-driven market analysis** using Google Gemini, and delivers a **styled HTML email report**.

---

## 🚀 Features
- Fetches jobs from **SerpAPI** + **JSearch API**
- Filters by location (**Bangalore / Bengaluru only**)
- Deduplicates by job title, company, and location
- AI-generated insights on:
    - Hiring trends
    - Salary benchmarks
    - Best companies in Bangalore
- Sends daily summary emails (with Markdown → HTML formatting)
- Simple **web UI** with glossy job cards

---

## 🤖 AI Job Agent

AI-powered job aggregation tool that fetches the latest openings in **Bangalore, India** from **SerpAPI** and **JSearch**, filters & deduplicates them, generates an **AI-driven market analysis** using Google Gemini, and delivers a **styled HTML email report**.  
It also includes a glossy **web dashboard** to fetch and view jobs in a card-based layout.

---

## 🚀 Features
- Fetches jobs from **SerpAPI** + **JSearch API**
- Filters by location (**Bangalore / Bengaluru only**)
- Deduplicates by job title, company, and location
- AI-generated insights on:
    - Hiring trends
    - Salary benchmarks
    - Best companies in Bangalore
- Sends daily summary emails (Markdown → HTML)
- Simple **web UI** with glossy job cards

---

## 🛠️ Setup

### 1. Clone Repo
```bash
git clone https://github.com/your-repo/ai-job-agent.git
cd ai-job-agent

```

### 2. Install Dependencies
```bash
npm install
```
DEPENDENCIES INCLUDE:

| Package                   | Purpose                                      |
| ------------------------- | -------------------------------------------- |
| **@google/generative-ai** | Gemini API client for AI analysis            |
| **nodemailer**            | Send emails via SMTP                         |
| **marked**                | Convert AI Markdown output to HTML for email |

### 3. Environment Variables
Create a `.env` file in the root directory with the following variables:
```env
# 🔑 API Keys
SERPAPI_KEY=your_serpapi_key
JSEARCH_API_KEY=your_jsearch_api_key
GOOGLE_AI_API_KEY=your_gemini_api_key

# 📧 Email Settings
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
EMAIL_TO=recipient@example.com
```

## ▶️ Run Locally
```bash
npm run dev
```
API will be available at:
👉 http://localhost:3000/api/job-agent

## 📧 Email Report
* Jobs summary (role, company, location, date, link)

* AI insights on recent hiring trends

* Salary package benchmarks (if available)

* Top companies hiring in Bangalore

Emails are sent via Gmail SMTP using App Passwords.

## 🌐 Web UI
Open index.html (frontend) for a simple glossy dashboard:

* Fetch Jobs button → calls API

* Jobs displayed as responsive cards with:

1. Job Title

3. Company

5. Location

7. Date Posted

9. Link to apply

## 📄 License
MIT License © 2025
You’re free to modify, distribute, and use this project for personal or commercial purposes.
