# Kassa Project

This is a full-stack web application built with **FastAPI** (Backend) and **React** (Frontend).

## Project Structure

- **backend/**: Contains the Python FastAPI application, handling API requests, authentication, and database interactions.
- **frontend/**: Contains the React application using Vite, managing the user interface and client-side routing.

## Prerequisites

Before running the project, ensure you have the following installed:

- **Python 3.8+**
- **Node.js** (LTS version recommended)
- **MySQL Database**

---

## Backend Setup

1.  **Navigate to the backend directory:**
    ```bash
        cd backend
    ```

2.  **Create a virtual environment (optional but recommended):**
    ```bash
    python -m venv venv
    # Activate on Windows:
    .\venv\Scripts\activate
    # Activate on macOS/Linux:
    source venv/bin/activate
    ```

3.  **Install dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

4.  **Configuration:**
    - Ensure your MySQL database is running.
    - Check `settings.py` or create a `.env` file (if applicable) to configure your database credentials and secret keys.

5.  **Run the application:**
    ```bash
    uvicorn api:app --reload
    ```
    The API will be available at `http://127.0.0.1:8000`.
    Swagger documentation is available at `http://127.0.0.1:8000/docs`.

---

## Frontend Setup

1.  **Navigate to the frontend directory:**
    ```bash
    cd frontend
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Run the development server:**
    ```bash
    npm run dev
    ```
    The application will be accessible at `http://localhost:5173` (or the port specified by Vite).

---

## Features

- **Authentication**: Login and Logout functionality using JWT.
- **User Management**: Profile viewing and editing.
- **Interactive UI**: Built with React, Bootstrap 5, and `@xyflow/react`.
- **API**: powered by FastAPI with MySQL integration.

## License

[Add your license here]
