/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID: string
  readonly VITE_SPREADSHEET_ID: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// Google Identity Services types
interface GoogleCredentialResponse {
  credential: string
  select_by: string
  clientId: string
}

interface GoogleTokenResponse {
  access_token: string
  expires_in: number
  scope: string
  token_type: string
  error?: string
  error_description?: string
}

interface Google {
  accounts: {
    id: {
      initialize: (config: {
        client_id: string
        callback: (response: GoogleCredentialResponse) => void
        auto_select?: boolean
      }) => void
      prompt: () => void
      renderButton: (
        element: HTMLElement,
        config: {
          type?: 'standard' | 'icon'
          theme?: 'outline' | 'filled_blue' | 'filled_black'
          size?: 'large' | 'medium' | 'small'
          text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
          shape?: 'rectangular' | 'pill' | 'circle' | 'square'
          logo_alignment?: 'left' | 'center'
          width?: number
          locale?: string
        }
      ) => void
      disableAutoSelect: () => void
      revoke: (hint: string, callback: () => void) => void
    }
    oauth2: {
      initTokenClient: (config: {
        client_id: string
        scope: string
        callback: (response: GoogleTokenResponse) => void
        error_callback?: (error: { type: string; message: string }) => void
      }) => {
        requestAccessToken: (options?: { prompt?: string }) => void
      }
      revoke: (accessToken: string, callback: () => void) => void
    }
  }
}

declare global {
  interface Window {
    google: Google
  }
}

