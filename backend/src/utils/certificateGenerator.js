import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";

import { Octokit } from "@octokit/rest";

import fs from "fs";

import dotenv from "dotenv";



dotenv.config();



const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });



const OWNER = "prakhargupta63900-sketch";

const REPO = "certificate-storage";

const BRANCH = "main";



export const generateCertificatePdf = async ({ certificateId, userName, courseTitle, issuedAt }) => {

  const pdfDoc = await PDFDocument.create();

  const page = pdfDoc.addPage([900, 600]);



  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);



  // Background

  page.drawRectangle({

    x: 0,

    y: 0,

    width: page.getWidth(),

    height: page.getHeight(),

    color: rgb(0.05, 0.1, 0.2),

  });



  // Certificate Title

  page.drawText("CERTIFICATE OF COMPLETION", {

    x: 150,

    y: 500,

    size: 32,

    font: helveticaBold,

    color: rgb(1, 1, 1),

  });



  // Subtitle

  page.drawText("This certificate is proudly presented to", {

    x: 150,

    y: 450,

    size: 18,

    font: helvetica,

    color: rgb(0.9, 0.9, 0.9),

  });



  // User Name

  page.drawText(userName, {

    x: 150,

    y: 400,

    size: 28,

    font: helveticaBold,

    color: rgb(1, 0.85, 0.2), // gold

  });



  // Completion text

  page.drawText("has successfully completed", {

    x: 150,

    y: 360,

    size: 18,

    font: helvetica,

    color: rgb(0.9, 0.9, 0.9),

  });



  // Course Title

  page.drawText(courseTitle, {

    x: 150,

    y: 325,

    size: 20,

    font: helveticaBold,

    color: rgb(0.2, 0.6, 1),

  });



  // Issue Date

  page.drawText(`Issued on ${new Date(issuedAt).toDateString()}`, {

    x: 150,

    y: 250,

    size: 14,

    font: helvetica,

    color: rgb(0.9, 0.9, 0.9),

  });



  // Optionally add seal/logo

  // const pngBytes = fs.readFileSync("/mnt/data/Screenshot 2025-11-20 162613.png");

  // const pngImage = await pdfDoc.embedPng(pngBytes);

  // page.drawImage(pngImage, { x: 700, y: 200, width: 100, height: 100 });



  const pdfBytes = await pdfDoc.save();

  const pdfBase64 = Buffer.from(pdfBytes).toString("base64");



  const filePath = `certificates/certificate_${certificateId}.pdf`;



  try {

    await octokit.repos.createOrUpdateFileContents({

      owner: OWNER,

      repo: REPO,

      path: filePath,

      message: `Add certificate ${certificateId}`,

      content: pdfBase64,

      branch: BRANCH,

    });

  } catch (err) {

    console.error("GitHub upload failed:", err);

    throw new Error("Failed to upload PDF to GitHub");

  }



  return `https://${OWNER}.github.io/${REPO}/${filePath}`;

};