// app.js
const express = require('express');
const { google } = require('googleapis');
const { OAuth2Client } = require('google-auth-library');
const nodemailer = require('nodemailer');
const mongoose = require('mongoose');
const config = require('./config');
const cors=require('cors');


const app = express();
app.use(express.json())
// app.use(cors)

// Connect to MongoDB
mongoose.connect('mongodb://127.0.0.1:27017/gmail-app', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
// const db = mongoose.connection;
// db.on('error', console.error.bind(console, 'MongoDB connection error:'));

// Define schema and model for storing tokens
const tokenSchema = new mongoose.Schema({
  refreshToken: String,
  accessToken: String,
});
const Token = mongoose.model('Token', tokenSchema);

// Configure Nodemailer transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    type: 'OAuth2',
    user: 'vishwakarmayash619@gmail.com',
    pass:"Yash12345@",
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    refreshToken: config.refreshToken,
  },
});

// Set up routes
const authClient = new OAuth2Client(config.clientId, config.clientSecret, config.redirectUri);
app.get('/auth',(req, res) => {
 
  // const authClient = new OAuth2Client(config.clientId, config.clientSecret, config.redirectUri);
  const authUrl = authClient.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://mail.google.com/'],
  });
  res.redirect(authUrl);
});

app.get('/auth/callback', async (req, res) => {
  // const authClient = new OAuth2Client(config.clientId, config.clientSecret, config.redirectUri);
  const { tokens } = await authClient.getToken(req.query.code);
  const token = new Token({
    refreshToken: tokens.refresh_token,
    accessToken: tokens.access_token,
  });
  await token.save();
  res.send('Authentication successful! You can close this window now.');
});

//=========================================================================================================================


// Create a Gmail client
async function createGmailClient() {
    const token = await Token.findOne().exec();
    if (!token) {
      throw new Error('Access token not found');
    }
  
    const authClient = new OAuth2Client(config.clientId, config.clientSecret, config.redirectUri);
    authClient.setCredentials({
      refresh_token: token.refreshToken,
      access_token: token.accessToken,
    });
  
    return google.gmail({
      version: 'v1',
      auth: authClient,
    });
  }
  
  // Function to send a reply email
  async function sendReply(subject, to, message) {
    console.log("hello");
    const mailOptions = {
      from: 'vishwakarmayash619@gmail.com',
      to:to,
      subject:subject,
      text: message,
    };
  
    return transporter.sendMail(mailOptions, function(err, data) {
      if (err) {
         console.log("Error: " + err);
      } else {
         console.log("Email sent successfully");
      }
   });
  }
  
  // Function to apply a label to an email
  async function applyLabel(emailId, labelName) {
    const gmail = await createGmailClient();
  
    const res = await gmail.users.messages.modify({
      userId: 'me',
      id: emailId,
      resource: {
        addLabelIds: [labelName],
      },
    });
  
    return res;
  }
  
  // Function to check if an email has prior replies
  async function hasPriorReplies(emailId) {
    
    const gmail = await createGmailClient();
    
  
    const res = await gmail.users.threads.get({
      userId: 'vishwakarmayash619@gmail.com',
      id: emailId,
      format: 'full',
    });
    console.log("heloo");
  
    const thread = res.data;
    return thread.messages.length > 1;
  }
  
  // Route for processing incoming emails
  app.post('/incoming', async (req, res) => {
   
    console.log(req.body);
    const { subject, from, text, messageId } = req.body;
  
    
    if (await hasPriorReplies(messageId)) {
      console.log(`Email ${messageId} already has prior replies. Ignoring.`);
      return res.sendStatus(200);
    }
 
  
    const replySubject = `Re: ${subject}`;
    const replyMessage = `Thank you for your email! This is an automated response.`;
  
    try {
      
      await sendReply(replySubject, from, replyMessage);
      await applyLabel(messageId, 'AutoReplied');
      console.log(`Sent reply for email ${messageId}`);
      res.sendStatus(200);
    } catch (err) {
      console.error(`Error sending reply for email ${messageId}:`, err);
      res.sendStatus(500);
    }
  });
  


//=========================================================================================================================

app.listen(3000, () => {
  console.log('Server listening on port 3000');
});
