# Step-by-Step Deployment Guide

## Changes Already Made (Done for you):
1. ✅ Created `frontend/.env` with backend URL
2. ✅ Updated `backend/server.js` CORS for Vercel

---

## Step 1: Push Code to GitHub

1. Open your terminal in the project folder
2. Run these commands:
   ```bash
   git add .
   git commit -m "Update CORS for production"
   git push origin main
   ```

---

## Step 2: Deploy Backend on Render

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Find your backend service (`more-power-newsupdate1`)
3. Click "Deploy" or it will auto-deploy from your GitHub push
4. Wait for deployment to complete
5. Your backend is live at: `https://more-power-newsupdate1.onrender.com`

---

## Step 3: Deploy Frontend on Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Find your frontend project (`more-power-newsupdate1`)
3. Go to **Settings** → **Environment Variables**
4. Add this variable:
   - **Name:** `VITE_API_BASE_URL`
   - **Value:** `https://more-power-newsupdate1.onrender.com`
5. Go to **Deployments**
6. Click **"Redeploy"** on the latest deployment (or push to GitHub to trigger auto-deploy)

---

## Step 4: Verify It Works

1. Open your browser and go to: `https://more-power-newsupdate1.vercel.app`
2. The website should now load and fetch data from your backend
3. Test the admin login at `/admin` to make sure authentication works

---

## Troubleshooting

**If API calls fail:**
- Check browser console (F12) for errors
- Make sure Vercel environment variable is set correctly
- Verify Render backend is running

**If login doesn't work:**
- Clear browser cookies and try again
- Make sure both frontend and backend are deployed

