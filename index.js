console.log('Die index.js wird gestartet...'); // Log message to indicate that the index.js file is starting

require('dotenv').config(); // Load environment variables from the .env file
const express = require('express'); // Import Express for setting up the backend server
const axios = require('axios'); // Import Axios for making HTTP requests
const vision = require('@google-cloud/vision'); // Import Google Cloud Vision for image recognition
const multer = require('multer'); // Import Multer for handling file uploads
const fs = require('fs'); // Import fs to handle file system operations (like deleting uploaded files)
const cors = require('cors'); // Import CORS to allow cross-origin requests

const app = express(); // Create an Express app
const port = process.env.PORT || 4000; // Use the dynamic port assigned by Heroku or fallback to port 4000 for local development

// Enable CORS to allow requests from different origins
app.use(cors());

// Configure Multer for storing uploaded files in the 'uploads/' directory
const upload = multer({ dest: 'uploads/' });

// Load the Spoonacular API key from the .env file
const spoonacularApiKey = process.env.SPOONACULAR_API_KEY; // API key is retrieved from environment variables

// Initialize the Google Vision API client with credentials from the .env file
const client = new vision.ImageAnnotatorClient({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS // Path to the Google Cloud credentials file
});

// Enable JSON body parsing in Express
app.use(express.json());

// Route for processing uploaded images and detecting ingredients using Google Vision API
app.post('/detect-ingredients', upload.single('image'), async (req, res) => {
  try {
    const imagePath = req.file.path; // Get the path of the uploaded image
    const [result] = await client.textDetection(imagePath); // Call Google Vision API to detect text in the image

    // Delete the uploaded file after processing
    fs.unlinkSync(imagePath);

    // Extract the detected text (ingredients) from the image
    const ingredientsText = result.textAnnotations[0]?.description;

    if (ingredientsText) {
      // Convert the text into an array and filter out any invalid entries
      const ingredientsArray = ingredientsText.split('\n').slice(1);
      const cleanedIngredientsArray = ingredientsArray.filter(item => item && item.length > 2);
      res.json({ detectedIngredients: cleanedIngredientsArray }); // Send the cleaned ingredients back to the client
    } else {
      res.status(400).json({ error: 'Keine Zutaten erkannt' }); // If no ingredients are detected, send an error
    }
  } catch (error) {
    console.error('Fehler bei der Bildverarbeitung:', error); // Log any errors during image processing
    res.status(500).json({ error: 'Fehler bei der Bildverarbeitung', details: error.message }); // Send error response
  }
});

// Route for fetching recipes based on the detected ingredients
app.post('/recipes', async (req, res) => {
  try {
    const { ingredients } = req.body; // Extract ingredients from the request body
    
    // Send a request to Spoonacular API to find recipes based on ingredients
    const response = await axios.get(`https://api.spoonacular.com/recipes/findByIngredients`, {
      params: {
        ingredients: ingredients.join(','), // Join ingredients into a single string
        number: 10, // Limit the results to 10 recipes
        apiKey: spoonacularApiKey, // Use the Spoonacular API key from the environment
      },
    });

    res.json(response.data); // Send the fetched recipes back to the client
  } catch (error) {
    console.error("Error fetching recipes: ", error.response?.data || error.message); // Log the error
    res.status(500).json({ error: "Fehler beim Abrufen der Rezepte" }); // Send error response
  }
});

// Route for fetching detailed information about a specific recipe by ID
app.get('/recipe/:id', async (req, res) => {
  const { id } = req.params; // Extract the recipe ID from the request URL

  try {
    // Fetch detailed information about the recipe using the Spoonacular API
    const response = await axios.get(`https://api.spoonacular.com/recipes/${id}/information`, {
      params: {
        apiKey: spoonacularApiKey, // Use the Spoonacular API key from the environment
      },
    });

    res.json(response.data); // Send the recipe details back to the client
  } catch (error) {
    console.error("Error fetching recipe details: ", error.response?.data || error.message); // Log the error
    res.status(500).json({ error: "Fehler beim Abrufen der Rezeptdetails" }); // Send error response
  }
});

// Start the server
console.log('Server wird gestartet...'); // Log message to indicate server start
app.listen(port, () => {
  console.log(`Backend läuft auf port:${port}`); // Log the server's running URL
});
