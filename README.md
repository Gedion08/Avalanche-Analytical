# Avalanche Analytical

## Project Description

Avalanche Analytical is a comprehensive analytics platform designed for the Avalanche blockchain ecosystem. It provides real-time data ingestion, processing, aggregation, and visualization of blockchain metrics across the C-Chain, P-Chain, and X-Chain. The platform features a robust back-end for data handling and a modern React-based front-end for interactive dashboards, including 3D network visualizations and real-time charts.

The system leverages microservices architecture with message queuing for scalable data processing, caching for performance, and real-time updates via WebSockets. It's built to handle high-volume blockchain data while providing actionable insights through predictive analytics and consensus monitoring.

## Features

- **Multi-Chain Data Ingestion**: Real-time data collection from Avalanche's C-Chain (Contract Chain), P-Chain (Platform Chain), and X-Chain (Exchange Chain)
- **Real-Time Analytics**: Live metrics and dashboards with WebSocket-powered updates
- **3D Network Visualization**: Interactive three-dimensional representations of network topology using Three.js
- **Predictive Analytics**: Machine learning-based forecasting for blockchain metrics using regression models
- **Consensus Monitoring**: Real-time tracking of validator consensus and subnet performance
- **Data Archiving**: Automated daily archiving of historical data for long-term storage
- **Authentication & Authorization**: Secure API access with JWT-based authentication
- **Metrics & Monitoring**: Prometheus-compatible metrics collection and logging with Winston
- **Scalable Architecture**: Message queuing with RabbitMQ and caching with Redis for high-performance data processing
- **Comprehensive Testing**: Full test coverage with Jest and Supertest for API testing

## Architecture Overview

The project follows a microservices-inspired architecture with clear separation of concerns:

### Back-End (src/)

- **API Layer** (`src/api/`): Express.js server with RESTful endpoints and Socket.IO for real-time communication
- **Ingestion Layer** (`src/ingestion/`): Specialized modules for each Avalanche chain (C-Chain, P-Chain, X-Chain) using the Avalanche SDK
- **Processing Layer** (`src/processing/`): Data aggregation, consensus algorithms, and archiving logic
- **Models Layer** (`src/models/`): Database schemas and interactions for PostgreSQL
- **Utils Layer** (`src/utils/`): Shared utilities for caching (Redis), logging (Winston), and metrics (Prometheus)

### Front-End (client/)

- **React Application**: Built with Create React App, featuring component-based architecture
- **Visualization Components**: Chart.js for 2D charts and Three.js with React Three Fiber for 3D network graphs
- **API Integration**: Axios for HTTP requests and Socket.IO client for real-time updates
- **Pages**: Dashboard and other analytical views

### External Services

- **PostgreSQL**: Primary database for structured data storage
- **Redis**: In-memory caching and session storage
- **RabbitMQ**: Message queuing for asynchronous data processing
- **Prometheus**: Metrics collection and monitoring

## Technologies Used

### Back-End

- **Node.js**: Runtime environment
- **Express.js**: Web framework for API development
- **Avalanche SDK**: Official SDK for Avalanche blockchain interaction
- **PostgreSQL**: Relational database with pg driver
- **Redis**: In-memory data structure store
- **RabbitMQ**: Message broker with amqplib
- **Socket.IO**: Real-time bidirectional communication
- **JWT**: JSON Web Tokens for authentication
- **Winston**: Logging library
- **Prometheus Client**: Metrics collection
- **Node-cron**: Task scheduling
- **bcryptjs**: Password hashing

### Front-End

- **React**: UI library with hooks and functional components
- **Chart.js & React-Chartjs-2**: Data visualization
- **Three.js & React Three Fiber**: 3D graphics and animations
- **Axios**: HTTP client for API calls
- **Socket.IO Client**: Real-time communication
- **React Testing Library**: Component testing utilities

### Development & Testing

- **Jest**: Testing framework
- **Supertest**: API testing
- **ESLint**: Code linting (configured in client)

## Prerequisites

Before running the project, ensure you have the following installed:

- **Node.js** (v14 or higher) - [Download](https://nodejs.org/)
- **PostgreSQL** (v12 or higher) - [Download](https://www.postgresql.org/download/)
- **Redis** (v6 or higher) - [Download](https://redis.io/download)
- **RabbitMQ** (v3.8 or higher) - [Download](https://www.rabbitmq.com/download.html)
- **Git** - [Download](https://git-scm.com/)

## Installation

1. **Clone the repository:**

   ```bash
   git clone <repository-url>
   cd avalanche
   ```

2. **Install back-end dependencies:**

   ```bash
   npm install
   ```

3. **Install front-end dependencies:**
   ```bash
   cd client
   npm install
   cd ..
   ```

## Environment Setup

1. **Create environment file:**
   Copy the `.env` file and configure the following variables:

   ```env
   # Database
   DATABASE_URL=postgresql://username:password@localhost:5432/avalanche_db

   # Redis
   REDIS_URL=redis://localhost:6379

   # RabbitMQ
   RABBITMQ_URL=amqp://localhost

   # JWT
   JWT_SECRET=your-super-secret-jwt-key

   # Server
   PORT=3000

   # Avalanche Network
   AVALANCHE_NETWORK=mainnet  # or testnet
   ```

2. **Set up PostgreSQL database:**

   ```bash
   createdb avalanche_db
   ```

3. **Start external services:**
   - **Redis:** `redis-server`
   - **RabbitMQ:** `rabbitmq-server`
   - **PostgreSQL:** Ensure it's running

## Usage

### Back-End

1. **Start the server:**

   ```bash
   npm start
   ```

   The server will start on port 3000 (or as configured in `.env`).

2. **API Endpoints:**

   - `GET /api/analytics` - Retrieve analytics data
   - `POST /api/auth/login` - User authentication
   - `GET /metrics` - Prometheus metrics

3. **Real-time Updates:**
   The server supports WebSocket connections for real-time data streaming.

### Front-End

1. **Start the development server:**

   ```bash
   cd client
   npm start
   ```

   The React app will be available at `http://localhost:3000`.

2. **Build for production:**

   ```bash
   cd client
   npm run build
   ```

3. **Features:**
   - **Dashboard**: Main analytics view with charts and metrics
   - **3D Network**: Interactive network topology visualization
   - **Real-time Charts**: Live updating data visualizations

## Testing

The project includes comprehensive testing with Jest:

1. **Run all tests:**

   ```bash
   npm test
   ```

2. **Run tests with coverage:**

   ```bash
   npm test -- --coverage
   ```

3. **Test Structure:**
   - `tests/api.test.js` - API endpoint testing with Supertest
   - `tests/ingestion.test.js` - Data ingestion logic testing
   - `tests/processing.test.js` - Data processing and aggregation testing

Coverage reports are generated in the `coverage/` directory and can be viewed by opening `coverage/lcov-report/index.html` in a browser.

## Deployment

### Back-End Deployment

1. **Build and deploy:**

   ```bash
   npm run build  # If build script exists
   # Deploy to your preferred hosting (Heroku, AWS, etc.)
   ```

2. **Environment Variables:**
   Ensure all production environment variables are set in your deployment platform.

3. **Database Migration:**
   Run any necessary database migrations for production.

### Front-End Deployment

1. **Build the production bundle:**

   ```bash
   cd client
   npm run build
   ```

2. **Deploy the `build` folder:**
   - To Netlify: Connect your repository and set build command to `npm run build` in `client/`
   - To Vercel: Import the project and configure the root directory as `client/`
   - To AWS S3/CloudFront: Upload the `build` folder contents

### Docker Deployment (Optional)

If using Docker:

1. **Build images:**

   ```bash
   docker build -t avalanche-backend .
   docker build -t avalanche-frontend ./client
   ```

2. **Run containers:**
   ```bash
   docker-compose up
   ```

## Contributing

We welcome contributions to Avalanche Analytical! Please follow these guidelines:

1. **Fork the repository** and create a feature branch
2. **Follow coding standards:** Use ESLint configuration and maintain test coverage
3. **Write tests** for new features and bug fixes
4. **Commit messages:** Use conventional commits (e.g., `feat: add new analytics endpoint`)
5. **Pull Request:** Provide a clear description of changes and reference any related issues

### Development Workflow

1. Install dependencies and set up environment as described above
2. Run tests before committing: `npm test`
3. Ensure code coverage remains above 80%
4. Update documentation for any API changes

## License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## Contact

For questions, issues, or contributions:

- **Email:** [your-email@example.com]
- **GitHub Issues:** [Repository Issues](https://github.com/your-username/avalanche/issues)
- **Discord:** [Join our community](https://discord.gg/your-invite)

---

_Built with ❤️ for the Avalanche ecosystem_
