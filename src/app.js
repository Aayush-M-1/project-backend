import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"

const app = express()

app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}))

//use keyword is used for configuration/cors
app.use(express.json({limit: "16kb"}))
app.use(express.urlencoded({extended: true, limit: "16kb"}))
app.use(express.static("public")) //for storing assets like pdfs, etc.
app.use(cookieParser())

// routes import
import userRouter from "./routes/user.routes.js"


// routes declaration (using "use" instead of "get", because we use middlewares whenever files are separated)
app.use("/api/v1/users", userRouter)

// https://localhost:8000/api/v1/users/register

export { app }