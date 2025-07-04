# Railway Deployment Guide

Railway is a modern platform that makes it super easy to deploy your bot. Unlike Cloudflare Workers, Railway gives you a full Node.js environment, so your original code works without modifications!

## Why Railway is Great for This Bot

- **Full Node.js support**: All your dependencies work (Slack Bolt, MongoDB driver, etc.)
- **Zero config**: Just connect GitHub and deploy
- **Built-in MongoDB**: Can add MongoDB with one click
- **Environment variables**: Easy secret management
- **Automatic HTTPS**: Gets a URL like `crm-bot.up.railway.app`

## Quick Deploy Steps

### 1. Login to Railway
```bash
railway login
```

### 2. Initialize Project
```bash
railway link
# Or create new:
railway init
```

### 3. Add Environment Variables
```bash
railway variables set SLACK_BOT_TOKEN=xoxb-your-token
railway variables set SLACK_SIGNING_SECRET=your-secret
railway variables set SLACK_APP_TOKEN=xapp-your-token
railway variables set ANTHROPIC_API_KEY=sk-ant-your-key
railway variables set ATTIO_API_KEY=your-attio-key
```

### 4. Add MongoDB (Optional)
```bash
railway add mongodb
```

### 5. Deploy
```bash
railway up
```

### 6. Get Your URL
```bash
railway open
```

## GitHub Integration (Recommended)

1. Go to https://railway.app
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose `TheEthanDing/crm-bot`
5. Railway will:
   - Auto-detect Node.js
   - Install dependencies
   - Start your bot
   - Give you a URL

## Differences from Cloudflare Workers

### What Works Better on Railway:
- ✅ Full `@slack/bolt` package (Socket Mode works!)
- ✅ MongoDB native driver
- ✅ Any NPM package
- ✅ File system access
- ✅ Longer execution times
- ✅ WebSockets for real-time

### Trade-offs:
- 💰 Costs ~$5/month (vs Workers free tier)
- 🌍 Not edge-deployed (single region)
- ⏱️ Cold starts if inactive

## Migration from Workers

Since Railway supports full Node.js, you can use your original code:

1. Switch back to original entry point:
   ```json
   "main": "src/index-react.js"
   ```

2. Remove Worker-specific code
3. Deploy!

## Commands Reference

```bash
# Deploy
railway up

# View logs
railway logs

# Open dashboard
railway open

# Run locally with Railway env
railway run npm start

# Restart
railway restart
```

## Production Tips

1. **Add a health check endpoint**:
   ```javascript
   app.get('/health', (req, res) => {
     res.send('OK');
   });
   ```

2. **Set up monitoring**: Railway has built-in metrics

3. **Scale up**: Can increase resources in dashboard

4. **Custom domain**: Add your own domain in settings

## Cost Estimate

- **Starter**: $5/month (500 hours)
- **Your bot**: ~$5-10/month
- **MongoDB**: +$5/month (or use free tier elsewhere)

Much simpler than managing Cloudflare Workers limitations!