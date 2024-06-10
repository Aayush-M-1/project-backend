import { asyncHandler } from "../utils/asyncHandler.js" 
import {ApiError} from "../utils/ApiError.js"
import {User} from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import jwt from "jsonwebtoken"

// AsyncHandler is not required because it is not handling any web request
const generateAccessAndRefreshToken = async  (userId) => {
    try{
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({validateBeforeSave : false})

        return {accessToken, refreshToken}

    } catch(error){
        throw new ApiError(500, "Something went wrong while generating access and refresh token")
    }
}
 
const registerUser = asyncHandler( async (req,res) => {
    // get user details from frontend
    // validation - not empty
    // check if user already exists: username, email
    // check for images, check for avatar
    // upload them to cloudinary, avatar check
    // create user object - create entry in db
    // remove password and refresh token field from response
    // check for user creation
    // return res

    // get user details from frontend
    const {fullName, email, username, password} = req.body
    // console.log("email: ", email);
    // console.log(req.body)

    // validation - not empty
    // if(fullName === ""){
    //     throw new ApiError(400,"fullName is required")
    // }
    if (
        [fullName, email, username, password].some((field) => field?.trim() === "")
    ) {
        throw new ApiError(400, "All fields are required")
    }

    // check if user already exists: username, email
    const existedUser = await User.findOne({
        $or: [{ email: email }, { username: username }]
    })

    if(existedUser){
        throw new ApiError(409, "User with email or username already exists")
    }

    // check for images, check for avatar
    // console.log(req.files)
    const avatarLocalPath = req.files?.avatar[0]?.path;
    // const coverImageLocalPath = req.files?.coverImage[0]?.path;
    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
        coverImageLocalPath = req.files.coverImage[0].path
    }


    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar file is required")
    }

    // upload them to cloudinary, avatar check
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if(!avatar){
        throw new ApiError(400, "Avatar file is required (cloudinary)")
    }

    // create user object - create entry in db
    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
    })

    // check for user creation
    // remove password and refresh token field from response

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if(!createdUser){
        throw new ApiError(500, "Something went wrong while registering the user")
    }

    // return res
    return res.status(201).json(
        new ApiResponse(201, createdUser, "User registered successfully")
    )

} )

const loginUser = asyncHandler( async (req,res) => {
    // req.body -> data
    // username or email
    // find the user
    // password check
    // access and refresh token
    // send token in cookies

    // req.body -> data
    const {email, username, password} = req.body

    // username or email
    if(!username && !email){
        throw new ApiError(400, "username or password is required")
    }

    // find the user
    const user = await User.findOne({
        $or: [{email}, {username}]
    })

    if(!user){
        throw new ApiError(404, "User does not exist")
    }

    // password check
    const isPasswordValid = await user.isPasswordCorrect(password)

    if(!isPasswordValid){
        throw new ApiError(401, "Invalid Password")
    }

    // access and refresh token
    const {accessToken, refreshToken} = await generateAccessAndRefreshToken(user._id)

    const loggedInUser = await User.findOne(user._id).select("-password -refreshToken")

    // send token in cookies

    // Now the cookies can only be modified in server side
    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200,
            {
                user: loggedInUser, accessToken, refreshToken
            },
            "User logged in successfully"
        )
    )

})

const logoutUser = asyncHandler( async (req,res) => {
    // remove refreshToken
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined
            },
        },
        {
            new: true,
        }
    )

    // clear cookies
    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged out successfully"))
})

const refreshAccessToken = asyncHandler( async (req,res) => {
    // get refreshToken from cookies
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if (!incomingRefreshToken) {
        throw new ApiError(401, "unauthorized request (incomingRefreshToken)")
    }

    try {
        // verifying refreshToken (user: encrypted token, database: raw token)
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)
        const user = await User.findById(decodedToken._id) //refreshToken has _id (see user model)
    
        if (!user) {
            throw new ApiError(401, "Invalid refresh token")
        }
    
        // comparing incoming and user refresh token
        if (incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "Refresh Token is expired or used")
        }
    
        // generating new tokens
        const {accessToken,newRefreshToken} = await generateAccessAndRefreshToken(user._id)
    
        // sending into response and cookies
        const options = {
            httpOnly: true,
            secure: true
        }
    
        return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(
            new ApiResponse(
                200,
                {accessToken, refreshToken : newRefreshToken},
                "Access token refreshed successfully"
            )
        )
    } catch (error) {
        throw new ApiError(401, error?.message || "invalid refresh token")
    }

})

export { 
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken
}