import { expect } from '@jest/globals';

// Custom matchers for better error messages
expect.extend({
  toHaveValidId(received: any) {
    const pass = received && typeof received.id === 'string' && received.id.length > 0;
    if (pass) {
      return {
        message: () => `Expected ${received} not to have a valid id`,
        pass: true,
      };
    } else {
      return {
        message: () => `Expected ${received} to have a valid id, but got: ${received?.id}`,
        pass: false,
      };
    }
  },

  toHaveStatusCode(received: any, expected: number) {
    const pass = received.status === expected;
    if (pass) {
      return {
        message: () => `Expected response not to have status ${expected}`,
        pass: true,
      };
    } else {
      return {
        message: () => `Expected response to have status ${expected}, but got ${received.status}. Response body: ${JSON.stringify(received.body, null, 2)}`,
        pass: false,
      };
    }
  },

  toMatchUser(received: any, expected: any) {
    const pass = received.username === expected.username && 
                 received.display_name === expected.display_name &&
                 received.avatar_url === expected.avatar_url;
    if (pass) {
      return {
        message: () => `Expected user not to match`,
        pass: true,
      };
    } else {
      return {
        message: () => `Expected user to match:
Expected: ${JSON.stringify(expected, null, 2)}
Received: ${JSON.stringify(received, null, 2)}`,
        pass: false,
      };
    }
  }
});

// Declare the custom matchers for TypeScript
declare global {
  namespace jest {
    interface Matchers<R> {
      toHaveValidId(): R;
      toHaveStatusCode(expected: number): R;
      toMatchUser(expected: any): R;
    }
  }
}
