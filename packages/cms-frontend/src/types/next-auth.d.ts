import "next-auth"
import "next-auth/jwt"

declare module "next-auth" {
  interface User {
    role: string
    allowedExchanges: string[]
    accessToken: string
  }
  interface Session {
    user: User & {
      id: string
    }
    accessToken: string
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: string
    allowedExchanges: string[]
    accessToken: string
  }
}
