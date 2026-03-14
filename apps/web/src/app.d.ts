declare global {
  namespace App {
    interface Platform {
      env: {
        API: Fetcher;
      };
    }
  }
}

export {};
