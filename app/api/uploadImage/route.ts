import { type NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-middleware";
import { promises as fs } from "fs";
import path from "path";
import sharp from "sharp";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

// Disable body parsing, we'll handle it ourselves
export const config = {
  api: {
    bodyParser: false,
  },
};

export async function POST(req: NextRequest) {
  try {
    // Check if user is authenticated via session
    const session = await getServerSession(authOptions);
    let apiKey = req.headers.get("x-api-key") || new URL(req.url).searchParams.get("api_key");

    // If no API key provided but user is logged in, proceed with session
    if (!apiKey && !session) {
      return NextResponse.json({ error: "API key is required or you must be logged in" }, { status: 401 });
    }

    // If API key is provided, validate it
    if (apiKey) {
      const validationError = await validateApiKey(req, apiKey);
      if (validationError) {
        return validationError;
      }
    }

    // Ensure the upload directory exists
    const uploadDir = path.join(process.cwd(), "public", "image-data");
    try {
      await fs.access(uploadDir);
    } catch (error) {
      await fs.mkdir(uploadDir, { recursive: true });
    }

    // Parse the multipart form data
    const formData = await req.formData();
    const file = formData.get("image") as File;

    if (!file) {
      return NextResponse.json({ error: "No image file provided" }, { status: 400 });
    }

    // Check file type
    const fileType = file.type;
    if (!fileType.startsWith("image/")) {
      return NextResponse.json({ error: "File must be an image" }, { status: 400 });
    }

    // Generate a unique filename
    const timestamp = Date.now();
    const fileExtension = fileType.split("/")[1];
    const fileName = `image_${timestamp}.${fileExtension}`;
    const filePath = path.join(uploadDir, fileName);

    // Convert the file to a Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Process the image with sharp (resize if needed, optimize, etc.)
    let processedImage;
    try {
      processedImage = await sharp(buffer)
        .resize(1200, 1200, { fit: "inside", withoutEnlargement: true })
        .toBuffer();
    } catch (error) {
      console.error("Error processing image with sharp:", error);
      // If sharp fails, use the original buffer
      processedImage = buffer;
    }

    // Save the file locally
    try {
      await fs.writeFile(filePath, processedImage);
      console.log("File saved locally to:", filePath);
    } catch (error) {
      console.error("Error saving file locally:", error);
      return NextResponse.json({ error: "Failed to save image locally" }, { status: 500 });
    }

    // Generate the public URL for the image
    const imageUrl = `/image-data/${fileName}`;

    return NextResponse.json({
      success: true,
      message: "Image uploaded successfully",
      imageUrl,
    });
  } catch (error) {
    console.error("Error uploading image:", error);
    return NextResponse.json({ error: "Failed to upload image" }, { status: 500 });
  }
}