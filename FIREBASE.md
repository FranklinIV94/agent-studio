# Firebase — Agent Studio Demo

## Setup (5 minutes)

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Create a new project: **Agent Studio Demo**
3. Enable **Authentication** → **Anonymous** sign-in
4. Enable **Cloud Firestore** → Start in **test mode** (allows all reads/writes for 30 days — perfect for a hackathon)
5. Go to **Project Settings** → **General** → scroll to "Your apps" → Add Web app
6. Copy the firebaseConfig object
7. Create `.env.local` in the project root:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

## Firestore Schema

```
pipeline_runs/
  {runId}/
    userId: string
    input: string
    messages: AgentMessage[]
    result: ExecutionResult | null
    status: "running" | "completed" | "failed"
    createdAt: timestamp
```

## Security Rules (hackathon mode — open)

```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /pipeline_runs/{runId} {
      allow read, write: if true;
    }
  }
}
```

Lock this down before going to production.