// Shared documentation generation functions
// This file is imported by both popup.js and panel.js

// Convert API request to OpenAPI 3.0 format
function convertToOpenAPI(apiDoc) {
  const example = apiDoc.examples[0]; // Use first example as template
  const url = new URL(example.url);

  // Extract query parameters
  const queryParams = {};
  url.searchParams.forEach((value, key) => {
    queryParams[key] = {
      schema: { type: typeof value === 'number' ? 'number' : 'string' },
      description: '',
      example: value
    };
  });

  // Parse request body to infer schema
  let requestBodySchema = null;
  if (example.requestBody) {
    try {
      const bodyData = typeof example.requestBody === 'string'
        ? JSON.parse(example.requestBody)
        : example.requestBody;
      requestBodySchema = inferSchema(bodyData);
    } catch (e) {
      requestBodySchema = { type: 'string' };
    }
  }

  // Parse response body to infer schema
  let responseBodySchema = null;
  if (example.responseBody) {
    try {
      const responseData = typeof example.responseBody === 'string'
        ? JSON.parse(example.responseBody)
        : example.responseBody;
      responseBodySchema = inferSchema(responseData);
    } catch (e) {
      responseBodySchema = { type: 'string' };
    }
  }

  // Build OpenAPI path object
  const pathObj = {
    [apiDoc.method.toLowerCase()]: {
      summary: `${apiDoc.method} ${apiDoc.path}`,
      description: `从录制的请求中生成 (共 ${apiDoc.examples.length} 个示例)`,
      parameters: [],
      responses: {}
    }
  };

  // Add query parameters
  Object.entries(queryParams).forEach(([name, param]) => {
    pathObj[apiDoc.method.toLowerCase()].parameters.push({
      name: name,
      in: 'query',
      required: false,
      ...param
    });
  });

  // Add request body if exists
  if (requestBodySchema) {
    pathObj[apiDoc.method.toLowerCase()].requestBody = {
      required: true,
      content: {
        'application/json': {
          schema: requestBodySchema,
          example: example.requestBody
        }
      }
    };
  }

  // Add response
  const statusCode = String(example.status || 200);
  pathObj[apiDoc.method.toLowerCase()].responses[statusCode] = {
    description: example.statusText || 'Successful response',
    content: {
      'application/json': {
        schema: responseBodySchema || { type: 'object' },
        example: example.responseBody
      }
    }
  };

  // Build complete OpenAPI spec for this single endpoint
  const openAPISpec = {
    openapi: '3.0.0',
    info: {
      title: 'API Documentation',
      version: '1.0.0',
      description: `从浏览器请求自动生成的API文档`
    },
    servers: [
      {
        url: apiDoc.baseUrl,
        description: '服务器地址'
      }
    ],
    paths: {
      [apiDoc.path]: pathObj
    }
  };

  return openAPISpec;
}

// Infer JSON schema from data
function inferSchema(data) {
  if (data === null) {
    return { type: 'null' };
  }

  const type = Array.isArray(data) ? 'array' : typeof data;

  switch (type) {
    case 'array':
      return {
        type: 'array',
        items: data.length > 0 ? inferSchema(data[0]) : { type: 'object' }
      };

    case 'object':
      const properties = {};
      const required = [];

      Object.entries(data).forEach(([key, value]) => {
        properties[key] = inferSchema(value);
        if (value !== null && value !== undefined) {
          required.push(key);
        }
      });

      return {
        type: 'object',
        properties,
        required: required.length > 0 ? required : undefined
      };

    case 'number':
      return { type: Number.isInteger(data) ? 'integer' : 'number' };

    case 'boolean':
      return { type: 'boolean' };

    case 'string':
    default:
      return { type: 'string' };
  }
}

// Make functions available globally
if (typeof window !== 'undefined') {
  window.convertToOpenAPI = convertToOpenAPI;
  window.inferSchema = inferSchema;
}
