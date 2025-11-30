# Deployment Setup Guide

## Environment Variables Configuration

### Frontend (Vercel)

1. Go to your Vercel project settings
2. Navigate to **Environment Variables**
3. Add the following variable:

```
VITE_API_URL=https://cyber-platform-2fu7.onrender.com/api
```

**Important:** After adding the environment variable, you need to **redeploy** your frontend for the changes to take effect.

### Backend (Render)

1. Go to your Render dashboard
2. Select your backend service
3. Navigate to **Environment** tab
4. Add/Update the following variables:

```
FRONTEND_URL=https://cyber-platform-frontend.vercel.app
```

If you have other environment variables (MONGODB_URI, JWT_SECRET, etc.), make sure they are also set.

## Changes Made

### Frontend Changes:
1. ✅ Updated `frontend/src/api/axiosInstance.js` to use `VITE_API_URL` environment variable
2. ✅ Fixed hardcoded URL in `frontend/src/pages/Login.jsx`
3. ✅ Fixed hardcoded URL in `frontend/src/pages/Register.jsx`

### Backend Changes:
1. ✅ Added frontend URL to CORS allowed origins in `backend/src/app.js`

## Testing the Connection

1. **Backend Health Check:**
   - Visit: https://cyber-platform-2fu7.onrender.com
   - Should see: "Cyber Awareness Training API is running..."

2. **Frontend API Connection:**
   - After setting `VITE_API_URL` and redeploying, test login/register
   - Check browser console for any CORS errors

## Troubleshooting

### CORS Errors
- Make sure `FRONTEND_URL` is set correctly in backend environment variables
- Ensure the frontend URL matches exactly (including https://)
- Restart the backend service after adding environment variables

### API Connection Errors
- Verify `VITE_API_URL` is set in Vercel environment variables
- Make sure the URL includes `/api` at the end
- Redeploy frontend after adding environment variables
- Check browser network tab to see the actual API calls being made

### Environment Variables Not Working
- **Vercel:** Environment variables starting with `VITE_` are automatically available
- **Render:** Make sure to restart the service after adding environment variables
- Check that variable names match exactly (case-sensitive)



