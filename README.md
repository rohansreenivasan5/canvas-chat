# Canvas Chat

A Next.js application that provides an AI-powered project planning assistant using OpenAI's GPT-3.5 Turbo model.

## Features

- 🤖 AI-powered project planning assistance
- 💬 Simple chat interface for project discussions
- 🎨 Modern, responsive UI with Tailwind CSS
- 🚀 Ready for Vercel deployment
- 🔧 Easy local development setup

## Prerequisites

- Node.js 18+ 
- npm or yarn
- OpenAI API key

## Local Development

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd canvas-chat
npm install
```

### 2. Environment Setup

Create a `.env.local` file in the root directory:

```bash
OPENAI_API_KEY=your_openai_api_key_here
```

**Important**: Get your OpenAI API key from [OpenAI Platform](https://platform.openai.com/api-keys)

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Test the Application

1. Type a project planning prompt in the text area
2. Click "Get AI Response"
3. View the AI-generated response below

## Deployment to Vercel

### 1. Push to GitHub

```bash
git add .
git commit -m "Initial commit"
git push origin main
```

### 2. Deploy on Vercel

1. Go to [Vercel](https://vercel.com) and sign in
2. Click "New Project"
3. Import your GitHub repository
4. Add environment variable:
   - Key: `OPENAI_API_KEY`
   - Value: Your OpenAI API key
5. Deploy!

### 3. Environment Variables on Vercel

Make sure to add the `OPENAI_API_KEY` environment variable in your Vercel project settings.

## Project Structure

```
canvas-chat/
├── src/
│   ├── app/
│   │   ├── api/chat/route.ts    # OpenAI API endpoint
│   │   ├── page.tsx             # Main chat interface
│   │   ├── layout.tsx           # Root layout
│   │   └── globals.css          # Global styles
│   └── lib/
│       └── openai.ts            # OpenAI client configuration
├── .env.example                 # Environment template
└── README.md                    # This file
```

## API Endpoints

### POST /api/chat

Sends a prompt to OpenAI and returns the AI response.

**Request Body:**
```json
{
  "prompt": "Help me plan a new feature launch"
}
```

**Response:**
```json
{
  "response": "Here's a comprehensive plan for your feature launch..."
}
```

## Technologies Used

- **Next.js 15** - React framework with App Router
- **TypeScript** - Type-safe JavaScript
- **Tailwind CSS** - Utility-first CSS framework
- **OpenAI API** - AI language model integration

## Development Commands

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
```

## Troubleshooting

### Common Issues

1. **"Missing OPENAI_API_KEY" error**
   - Ensure `.env.local` exists with your API key
   - Restart the development server after adding the key

2. **API calls failing**
   - Check your OpenAI API key is valid
   - Ensure you have sufficient API credits
   - Check the browser console for error details

3. **Build errors**
   - Run `npm run lint` to check for TypeScript errors
   - Ensure all dependencies are installed

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test locally
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
- Check the troubleshooting section above
- Open an issue on GitHub
- Review the Next.js and OpenAI documentation
