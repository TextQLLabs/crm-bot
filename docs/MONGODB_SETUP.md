# MongoDB Setup for CRM Bot

You have two options for MongoDB:

## Option 1: Use Your Existing MongoDB Atlas Cluster (Recommended)

Since you already have a MongoDB MCP server configured with an "ethan-test" cluster:

1. **Get your existing connection string**:
   ```bash
   # In your terminal, check your MongoDB MCP configuration
   claude mcp list
   ```

2. **Find your MongoDB connection string** from one of these places:
   - Your MongoDB Atlas dashboard: https://cloud.mongodb.com
   - Your existing projects that use MongoDB
   - The MCP configuration you set up

3. **Update the connection string** in `.env`:
   - Take your existing connection string
   - Change the database name to `crm-bot`
   - Example: `mongodb+srv://username:password@ethan-test.xxxxx.mongodb.net/crm-bot?retryWrites=true&w=majority`

## Option 2: Create New Database in Existing Cluster

1. **Login to MongoDB Atlas**: https://cloud.mongodb.com
2. **Select your cluster** (ethan-test)
3. **Click "Browse Collections"**
4. **Click "Create Database"**:
   - Database name: `crm-bot`
   - Collection name: `interactions`
5. **Use your existing connection string** but with `/crm-bot` as the database

## Option 3: Use Local MongoDB (If Installed)

If you have MongoDB installed locally:
```
MONGODB_URI=mongodb://localhost:27017/crm-bot
```

## Testing the Connection

Once you've updated the `.env` file with your MongoDB URI, test it:

```bash
cd /Users/ethanding/projects/crm-bot
npm install
npm start
```

The bot will automatically create the necessary collections:
- `interactions` - Logs all bot interactions
- `cache` - Temporary cache with 5-minute TTL
- `errors` - Error logging

## Security Note

Make sure your MongoDB:
- Has authentication enabled
- Uses strong passwords
- Has IP whitelist configured (or 0.0.0.0/0 for Cloudflare Workers)