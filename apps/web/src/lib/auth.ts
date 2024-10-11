// import { prisma } from "@/lib/db";
// import { PrismaAdapter } from "@auth/prisma-adapter";
import { getServerSession, type NextAuthOptions } from "next-auth";
// import { Adapter } from "next-auth/adapters";
import CredentialsProvider from "next-auth/providers/credentials"


const VERCEL_DEPLOYMENT = !!process.env.VERCEL_URL;
export const authOptions: NextAuthOptions = {
    providers: [
        CredentialsProvider({
            // The name to display on the sign in form (e.g. 'Sign in with...')
            name: 'Credentials',
            // The credentials is used to generate a suitable form on the sign in page.
            // You can specify whatever fields you are expecting to be submitted.
            // e.g. domain, username, password, 2FA token, etc.
            // You can pass any HTML attribute to the <input> tag through the object.
            credentials: {
                username: { label: "Username", type: "text", placeholder: "jsmith" },
                password: { label: "Password", type: "password" }
            },
            async authorize(credentials, req) {
                // You need to provide your own logic here that takes the credentials
                // submitted and returns either a object representing a user or value
                // that is false/null if the credentials are invalid.
                // e.g. return { id: 1, name: 'J Smith', email: 'jsmith@example.com' }
                // You can also use the `req` object to obtain additional parameters
                // (i.e., the request IP address)
                // const res = await fetch("/your/endpoint", {
                //     method: 'POST',
                //     body: JSON.stringify(credentials),
                //     headers: { "Content-Type": "application/json" }
                // })
                // const user = await res.json()

                // If no error and we have user data, return it
                // if (res.ok && user) {
                //     return user
                // }
                // Return null if user data could not be retrieved
                return {
                    id: Date.now().toString(),
                    email: "testing@gmail.com",
                    name: "jhg"
                }
            }
        })
    ],
    pages: {
        signIn: `/auth`,
        verifyRequest: `/auth`,
        error: "/auth", // Error code passed in query string as ?error=
    },
    // adapter: PrismaAdapter(prisma) as Adapter,
    session: { strategy: "jwt" },
    cookies: {
        sessionToken: {
            name: `${VERCEL_DEPLOYMENT ? "__Secure-" : ""}next-auth.session-token`,
            options: {
                httpOnly: true,
                sameSite: "lax",
                path: "/",
                // When working on localhost, the cookie domain must be omitted entirely (https://stackoverflow.com/a/1188145)
                domain: VERCEL_DEPLOYMENT
                    ? `.${process.env.NEXT_PUBLIC_ROOT_DOMAIN}`
                    : undefined,
                secure: VERCEL_DEPLOYMENT,
            },
        },
    },
    callbacks: {
        jwt: async ({ token, user }) => {
            if (user) {
                token.user = user;
            }
            return token;
        },
        session: async ({ session, token }) => {
            session.user = {
                ...session.user,
                // @ts-expect-error
                id: token.sub,
                // @ts-expect-error
                username: token?.user?.username || token?.user?.gh_username,
            };
            return session;
        },
    },
};

export function getSession() {
    return getServerSession(authOptions) as Promise<{
        user: {
            id: string;
            name: string;
            username: string;
            email: string;
            image: string;
        };
    } | null>;
}

export function withSiteAuth(action: any) {
    return async (
        formData: FormData | null,
        siteId: string,
        key: string | null,
    ) => {
        const session = await getSession();
        if (!session) {
            return {
                error: "Not authenticated",
            };
        }

        // const site = await db.query.sites.findFirst({
        //     where: (sites, { eq }) => eq(sites.id, siteId),
        // });

        // if (!site || site.userId !== session.user.id) {
        //     return {
        //         error: "Not authorized",
        //     };
        // }

        // return action(formData, site, key);
    };
}

export function withPostAuth(action: any) {
    return async (
        formData: FormData | null,
        postId: string,
        key: string | null,
    ) => {
        const session = await getSession();
        if (!session?.user.id) {
            return {
                error: "Not authenticated",
            };
        }

        // const post = await db.query.posts.findFirst({
        //     where: (posts, { eq }) => eq(posts.id, postId),
        //     with: {
        //         site: true,
        //     },
        // });

        // if (!post || post.userId !== session.user.id) {
        //     return {
        //         error: "Post not found",
        //     };
        // }

        // return action(formData, post, key);
    };
}