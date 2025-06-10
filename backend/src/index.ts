// backend/src/index.ts
import express, { Express, Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";

//Load environment variables from .env file 
dotenv.config();

const app : Express = express()
const port: number = parseInt(process.env.PORT || "8000", 10)

//Middleware setup 
app.use(express.json()) //For parsing JSON request bodies 
app.use(express.urlencoded({extended:true})) //For parsing URL-encoded request bodies 

//CORS configuration for frontend and backend communication during development 
const allowedOrigins: string[] = [
  "http://localhost:3000" //My next.js front end 
  //Add any other origns if front-end is deployed elsewhere later on 
]
//Applying the CORS middleware to the app 
app.use(
  cors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      //Allow requests with no origin (like mobile apps, curl requests, or same origin)
      if(!origin || allowedOrigins.indexOf(origin) !== -1) {
          callback(null, true);
      }
      else {
        const msg = "The CORS policy for this site does not allow access from the specified Origin"
        callback(new Error(msg), false);
      }
    }
  })
);

// -------------- API ROUTES -------------------
//Root route 
app.get("/", (req: Request, res: Response) => {
  res.json({message: "Hello from NIH Co-pilot Backend!"})
})

//Status checking route - to check if API is alive 
app.get("/api/v1/status", (req: Request, res: Response) => {
  res.json({status: "okay", api_version: "v1"})
})

const nihAPIKey = process.env.NIH_API_KEY
if (!nihAPIKey){ 
  console.warn("WARNING: NIH_API_KEY environment variable not set.")
}

// ----------START SERVER -----------------------
app.listen(port, () => {
  console.log(`Server is running on port ${port}`)
  console.log(`Access it at http://localhost${port}`)
  console.log(`Status endpoint: http://localhost:${port}/api/v1/status`)
})