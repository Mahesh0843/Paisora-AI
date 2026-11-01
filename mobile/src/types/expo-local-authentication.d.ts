declare module 'expo-local-authentication' {
  export function hasHardwareAsync(): Promise<boolean>;
  export function isEnrolledAsync(): Promise<boolean>;
  export interface AuthenticationResult {
    success: boolean;
    error?: string;
  }
  export function authenticateAsync(options?: { promptMessage?: string }): Promise<AuthenticationResult>;
}
