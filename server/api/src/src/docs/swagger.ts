import swaggerJsdoc, { Options } from "swagger-jsdoc";

const options: Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Finia API",
      version: "1.0.0",
      description: "API documentation for Finia financial management system",
    },
    servers: [
      {
        url: "http://localhost:3000",
        description: "Development server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
  },

  // ✅ FIXED PATH
  apis: [`${process.cwd()}/src/routes/*.ts`],
};

const specs = swaggerJsdoc(options);

export default specs;
