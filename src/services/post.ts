import { options } from "sanitize-html";
import { prisma } from "../lib/prisma.js";
import { ResponseError } from "../utils/responseError.js";
import { deletePostImages } from "../utils/fileHelper.js";

export type PostPropsType = {
  title: string;
  content: string;
  body: string;
  image: string | null;
  authorId: number;
  // categoryName: string;
  // typeName: string;
  tags: string[];
};

export const createOnePost = async (postData: PostPropsType) => {
  const data: any = {
    title: postData.title,
    content: postData.content,
    body: postData.body,
    image: postData.image,
    user: {
      connect: {
        id: postData.authorId,
      },
    },
  };
  if (postData.tags && postData.tags.length > 0) {
    data.tags = {
      connectOrCreate: postData.tags.map((tag) => ({
        where: { name: tag },
        create: { name: tag },
      })),
    };
  }
  return prisma.post.create({
    data: data,
    include: {
      user: true,
      tags: true,
      category: true,
      type: true,
    },
  });
};

export const updateOnePost = async (id: number, postData: PostPropsType) => {
  const post: any = await prisma.post.findUnique({
    where: {
      id: id,
    },
  });
  if (!post) {
    throw new ResponseError("Post not found", 404, "post_not_found");
  }
  const data: any = {
    title: postData.title,
    content: postData.content,
    body: postData.body,
  };
  if (postData.image) {
    if (post.image) {
      await deletePostImages(post.image);
    }
    data.image = postData.image;
  }

  if (postData.tags && postData.tags.length > 0) {
    data.tags = {
      set: [],
      connectOrCreate: postData.tags.map((tag) => ({
        where: { name: tag },
        create: { name: tag },
      })),
    };
  }

  return prisma.post.update({
    where: {
      id: id,
    },
    data,
    include: {
      tags: true,
      category: true,
      type: true,
    },
  });
};

export const getPost = async (id: number) => {
  const post = await prisma.post.findUnique({
    where: {
      id: id,
    },
    include: {
      tags: true,
      category: true,
      type: true,
    },
  });
  return post;
};
export const postDelete = async (id: number) => {
  const post = await prisma.post.findUnique({
    where: { id },
  });

  if (!post) {
    throw new ResponseError("Post not found", 404, "post_not_found");
  }

  const deletedPost = await prisma.post.delete({
    where: { id },
  });

  return deletedPost;
};

export const postWithRelation = async (id: number) => {
  const post = await prisma.post.findUnique({
    where: {
      id: id,
    },
    select: {
      id: true,
      title: true,
      content: true,
      body: true,
      image: true,
      updatedAt: true,
      category: {
        select: {
          name: true,
        },
      },
      user: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
      type: {
        select: {
          name: true,
        },
      },
      tags: {
        select: {
          name: true,
        },
      },
    },
  });
  const customizePost = {
    ...post,

    image: post!.image
      ? `http://localhost:${process.env.PORT}/uploads/optimize/${post!.image.replace(/\.[^/.]+$/, "")}.webp`
      : null,
    // updatedAt: post!.updatedAt.toISOString(),
    updatedAt: post!.updatedAt.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    user: post!.user
      ? {
          firstName: post!.user.firstName,
          lastName: post!.user.lastName,
          fullName: `${post!.user.firstName} ${post!.user.lastName}`,
        }
      : null,
  };
  return customizePost;
};

export const getPostsByPaginationWithOffset = async (options: any) => {
  const posts = await prisma.post.findMany({
    ...options,
  });
  return posts;
};
