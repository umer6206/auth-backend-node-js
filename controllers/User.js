import User from "../../model/User.js";
import userModel from "../../model/User.js";
import { uploadFileToAWS } from "../../utils/AWS.js";
import { validatePassword } from "../../utils/passwordValidators.js";
import sendEmail from "../../utils/sendEmail.js";
import mongoose from "mongoose";

export async function userSignUpController(req, res) {
  try {
    console.log(req.body);
    const { email, password, name } = req.body;
    if (!email) {
      return res.status(400).json({
        message: "Please provide email",
        success: false,
      });
    }
    if (!password) {
      return res.status(400).json({
        message: "Please provide password",
        success: false,
      });
    }
    if (!name) {
      return res.status(400).json({
        message: "Please provide name",
        success: false,
      });
    }
    const isPasswordValid = validatePassword(password);
    if (!isPasswordValid) {
      return res.status(400).json({
        message:
          "Password must contain at least one uppercase letter, one lowercase letter, one number, one special character, and be 8-15 characters long.",
        success: false,
      });
    }
    const existingUserVerifiedByEmail = await userModel.findOne({
      email,
      isVerified: true,
    });

    if (existingUserVerifiedByEmail) {
      return res.status(400).json({
        message: "User already exist!",
        success: false,
      });
    }
    const existingUserByEmail = await userModel.findOne({ email });
    // Generate a 4-digit OTP
    const generatedOtp = Math.floor(1000 + Math.random() * 9000).toString();
    if (existingUserByEmail) {
      if (existingUserByEmail.isVerified) {
        return res.status(400).json({
          message: "User already exist!",
          success: false,
        });
      } else {
        existingUserByEmail.password = password;
        existingUserByEmail.verifyCode = generatedOtp;
        const expiryDate = new Date();
        existingUserByEmail.verifyCodeExpiry = expiryDate.setMinutes(
          expiryDate.getMinutes() + 15
        );
        await existingUserByEmail.save();
      }
    } else {
      const expiryDate = new Date();
      expiryDate.setHours(expiryDate.getHours() + 1);
      const newUser = new userModel({
        name,
        email,
        password,
        verifyCode: generatedOtp,
        verifyCodeExpiry: expiryDate,
        isVerified: false,
      });
      await newUser.save();
    }
    //send verification email
    await sendEmail(email, generatedOtp, name);
    // const saveUser = await userData.save();
    res.status(201).json({
      success: true,
      message: "OTP: One Time password sent to this email, please verify",
      // otp: generatedOtp, // Optionally send the OTP back to the client
    });
  } catch (err) {
    res.json({
      message: err.message || err,
      success: false,
    });
  }
}
export async function verifyOtpController(req, res) {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({
        message: "Email and OTP are required",
        success: false,
      });
    }

    const user = await userModel.findOne({ email });
    console.log(user);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
        success: false,
      });
    }
    const isCodeValid = user.verifyCode === otp;
    const isCodeNotExpired = new Date(user.verifyCodeExpiry) > new Date();
    if (isCodeValid && isCodeNotExpired) {
      await userModel.updateOne({ _id: user._id }, { isVerified: true });
      return res.status(200).json({
        success: true,

        message: "Email verified successfully",
      });
    } else if (!isCodeNotExpired) {
      return res.status(400).json({
        success: false,
        message: "Verification code has expired, resend code to verify.",
      });
    } else {
      return res.status(400).json({
        success: false,

        message: "Incorrect verification code.",
      });
    }
  } catch (err) {
    res.status(400).json({
      message: err.message || "An error occurred during OTP verification",
      success: false,
    });
  }
}
export async function userSignInController(req, res) {
  const frontendHost = req.headers.origin;
  console.log(frontendHost);
  try {
    const { email, password } = req.body;

    if (!email) {
      return res.status(400).json({
        message: "Please provide email",
        success: false,
      });
    }
    if (!password) {
      return res.status(400).json({
        message: "Please provide password",
        success: false,
      });
    }

    const user = await userModel.findOne({ email });

    if (!user) {
      return res.status(404).json({
        message: "Invalid Credentials!",
        success: false,
      });
    }
    if (!user.isVerified) {
      return res.status(404).json({
        message: "User is not verified",
        success: false,
      });
    }
    if (!user?.password) {
      return res.status(400).json({
        message: "Invalid Credentials!",
        success: false,
      });
    }
    const isPasswordCorrect = await user.matchPassword(password);

    if (isPasswordCorrect) {
      // Hostname-based logic
      if (frontendHost === "https://www.evisavillage.com" && user.isAdmin) {
        return res.status(401).json({ message: "Invalid credentials." });
      }

      if (frontendHost === "https://admin.evisavillage.com" && !user.isAdmin) {
        return res.status(401).json({ message: "Invalid credentials." });
      }
      const token = await user.generateAccessToken();
      const userDataToSend = {
        _id: user._id,
        email: user.email,
        name: user.name,
        isVerified: user.isVerified,
      };
      const options = {
        httpOnly: true,
        secure: true,
      };
      res.status(200).cookie("token", token, options).json({
        message: "Login successfully",
        user: userDataToSend,
        token: token,
        success: true,
      });
    } else {
      return res.status(400).json({
        message: "Invalid Email or Password",
        success: false,
      });
    }
  } catch (err) {
    res.json({
      message: err.message || "Internal server Error in login",
      success: false,
    });
  }
}
export async function signinWithGoogleController(req, res) {
  const frontendHost = req.headers.origin;
  try {
    const { googleId, name, email } = req.body;
    if (!googleId || !name || !email) {
      return res
        .status(400)
        .send({ message: "Invalid Credentials", success: false });
    }

    let user = await userModel.findOne({ email, isVerified: true });
    if (!user && frontendHost === "https://www.evisavillage.com") {
      user = new userModel({ isVerified: true, ...req.body });
      await user.save();
    }
    if (!user && frontendHost === "https://admin.evisavillage.com") {
      return res.status(401).json({
        message: "Access Denied, You are not allowed to login.",
        success: true,
      });
    }
    if (frontendHost === "https://www.evisavillage.com" && user.isAdmin) {
      return res.status(401).json({
        message: "Access Denied, You are not allowed to login.",
        success: true,
      });
    }

    if (frontendHost === "https://admin.evisavillage.com" && !user.isAdmin) {
      return res.status(401).json({
        message: "Access Denied, You are not allowed to login.",
        success: true,
      });
    }
    const token = await user.generateAccessToken();

    const options = {
      httpOnly: true,
      secure: true,
    };
    res.status(200).cookie("token", token, options).json({
      message: "Login successfully",
      token: token,
      success: true,
    });
  } catch (err) {
    res.status(500).json({
      message: err.message || "Internal server Error in login",
      success: false,
    });
  }
}
export async function updateUserController(req, res) {
  const updateData = req.body;
  const userId = new mongoose.Types.ObjectId(req.user._id);
  try {
    const updatedUser = await userModel.findByIdAndUpdate(userId, updateData, {
      new: true,
      runValidators: true,
    });
    if (!updatedUser) {
      return res.status(404).json({
        message: "User not found",
        success: false,
      });
    }
    // Remove sensitive fields before sending the response
    const { password, expiryDate, verifytoken, ...userData } =
      updatedUser.toObject();
    const token = await updatedUser.generateAccessToken();
    const options = {
      httpOnly: true,
      secure: true,
    };
    res.status(200).cookie("token", token, options).json({
      message: "Updated successfully",
      user: userData,
      token: token,
      success: true,
    });
  } catch (error) {
    res.json({
      message: err.message || "Error while updating user",
      success: false,
    });
  }
}
export async function forgotPassword(req, res) {
  const { email } = req.body;
  try {
    const user = await userModel.findOne({ email });
    if (!user) {
      return res.status(404).json({
        message: "User not found!",
        success: false,
      });
    }
    // Generate a 4-digit OTP
    const generatedOtp = Math.floor(1000 + Math.random() * 9000).toString();
    const expiryDate = new Date();
    expiryDate.setMinutes(expiryDate.getMinutes() + 15);
    //add that otp in the db
    user.verifyCode = generatedOtp;
    user.verifyCodeExpiry = expiryDate;
    await user.save();

    //send verification email
    await sendEmail(email, generatedOtp, user.name);
    // const saveUser = await userData.save();
    res.status(201).json({
      success: true,
      message: "OTP: One Time password sent to this email, please verify",

      // otp: generatedOtp, // Optionally send the OTP back to the client
    });
  } catch (error) {
    res.json({
      message: error.message || "Error in forgot password",
      success: false,
    });
  }
}
export async function verifyOTPresetPassword(req, res) {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({
        message: "Email and OTP are required",
        success: false,
      });
    }
    const user = await userModel.findOne({ email });
    if (!user) {
      return res.status(404).json({
        message: "User not found",
        success: false,
      });
    }
    const isCodeValid = user.verifyCode === otp;
    const isCodeNotExpired = new Date(user.verifyCodeExpiry) > new Date();
    if (isCodeValid && isCodeNotExpired) {
      return res.status(200).json({
        success: true,

        message: "Email verified successfully",
      });
    } else if (!isCodeNotExpired) {
      return res.status(400).json({
        success: false,

        message: "Verification code has expired, resend code to verify.",
      });
    } else {
      return res.status(400).json({
        success: false,

        message: "Incorrect verification code.",
      });
    }
  } catch (error) {
    res.json({
      message: err.message || "Error in forgot password verify code",
      success: false,
    });
  }
}
export async function resetPassword(req, res) {
  const { email, password } = req.body;
  try {
    if (!email) {
      return res.status(400).json({
        message: "Please provide email",
        success: false,
      });
    }
    if (!password) {
      return res.status(400).json({
        message: "Please provide password",
        success: false,
      });
    }
    const isPasswordValid = validatePassword(password);
    console.log(isPasswordValid);
    if (!isPasswordValid) {
      return res.status(400).json({
        message:
          "Password must contain at least one uppercase letter, one lowercase letter, one number, one special character, and be 8-15 characters long.",
        success: false,
      });
    }
    const user = await userModel.findOne({ email });
    if (!user) {
      return res.status(404).json({
        message: "User not found",
        success: false,
      });
    }
    if (!user.isVerified) {
      return res.status(404).json({
        message: "User is not verified",
        success: false,
      });
    }
    user.password = password;
    await user.save();
    res.status(200).json({
      message: "Password reset successfully",
      success: true,
    });
  } catch (error) {
    res.json({
      message: err.message || "Error in reset password",
      success: false,
    });
  }
}
export async function UpdatePassword(req, res) {
  const userId = new mongoose.Types.ObjectId(req.user._id); // Assumes req.user is available from auth middleware
  const { currentPassword, newPassword } = req.body;

  try {
    // Ensure new password is provided
    if (!newPassword) {
      return res.status(400).json({
        message: "Please provide new password",
        success: false,
      });
    }

    // Validate the new password against the regex pattern
    if (!validatePassword(newPassword)) {
      return res.status(400).json({
        message:
          "Password must contain at least one uppercase letter, one lowercase letter, one number, one special character, and be 8-15 characters long.",
        success: false,
      });
    }

    // Find the user by ID
    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        message: "User not found",
        success: false,
      });
    }

    // Check if the user already has a password
    if (user.password) {
      // If current password is not provided, return an error
      if (!currentPassword) {
        return res.status(400).json({
          message: "Please provide current password",
          success: false,
        });
      }

      // Verify if the provided current password matches the user's actual current password
      const isCurrentPasswordValid = await user.matchPassword(currentPassword);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({
          message: "Current password is incorrect.",
          success: false,
        });
      }

      // Check if the new password is different from the current password
      if (currentPassword === newPassword) {
        return res.status(400).json({
          message: "New password cannot be the same as the current password.",
          success: false,
        });
      }
    }

    // If the user doesn't have a password, just set the new one without checking currentPassword
    user.password = newPassword;
    await user.save();

    res.status(200).json({
      message: "Password updated successfully",
      success: true,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message || "Error updating password",
      success: false,
    });
  }
}

export async function UpdateProfilePicture(req, res) {
  const userId = new mongoose.Types.ObjectId(req.user._id);

  try {
    const { profile } = req.body;
    if (!profile) {
      return res
        .status(400)
        .json({ message: "No file uploaded", success: false });
    }

    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        message: "User not found",
        success: false,
      });
    }

    const AwsResponse = await uploadFileToAWS(profile);
    if (!AwsResponse.success) {
      return res
        .status(400)
        .json({ message: "profle updation failed, something went wrong" });
    }
    // Update the user's profile picture URL
    const updatedUser = await userModel.findByIdAndUpdate(
      userId,
      { profile: AwsResponse.file_url }, // Only update the profile field
      { new: true, runValidators: false } // Return the updated document, disable validators
    );

    const token = await updatedUser.generateAccessToken();
    const options = {
      httpOnly: true,
      secure: true,
    };
    res.status(200).cookie("token", token, options).json({
      message: "profile picture updated successfully",
      token: token,
      success: true,
    });
  } catch (error) {
    res.json({
      message: error.message || "Error in updating profile picture",
      success: false,
    });
  }
}
export async function getLoggedInUser(req, res) {
  const userId = new mongoose.Types.ObjectId(req.user._id);
  try {
    const user = await userModel.findById(userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
        success: false,
      });
    }

    // Check if the user has a password and/or Google ID
    const hasPassword = user.password ? true : false;
    const hasGoogleId = user.googleId ? true : false;

    res.status(200).json({
      message: "Fetch user successfully",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        isVerified: user.isVerified,
        hasPassword, // Include whether the user has a password
        hasGoogleId, // Include whether the user has a Google ID
      },
      success: true,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error while Getting Logged In User information",
      success: false,
    });
  }
}

export function LogoutController(req, res) {
  try {
    res
      .clearCookie("token", {
        httpOnly: true,
        secure: true,
      })
      .status(200)
      .json({
        message: "Logout successful",
        success: true,
      });
  } catch (err) {
    res.status(500).json({
      message: err.message || "Internal server error in logout",
      success: false,
    });
  }
}
