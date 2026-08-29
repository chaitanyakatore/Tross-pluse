import { z } from 'zod';

export const ProfileRequestSchema = z.object({
  url: z.string().url('Invalid profile URL format'),
});

export type ProfileRequest = z.infer<typeof ProfileRequestSchema>;

export const ExperienceItemSchema = z.object({
  title: z.string(),
  companyName: z.string().optional(),
  companyUrl: z.string().optional(),
  locationName: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  description: z.string().optional(),
});

export type ExperienceItem = z.infer<typeof ExperienceItemSchema>;

export const EducationItemSchema = z.object({
  schoolName: z.string(),
  degreeName: z.string().optional(),
  fieldOfStudy: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  description: z.string().optional(),
});

export type EducationItem = z.infer<typeof EducationItemSchema>;

export const SkillItemSchema = z.object({
  name: z.string(),
  endorsementCount: z.number().optional(),
});

export type SkillItem = z.infer<typeof SkillItemSchema>;

export const CertificationItemSchema = z.object({
  name: z.string(),
  authority: z.string().optional(),
  url: z.string().optional(),
  startDate: z.string().optional(),
});

export type CertificationItem = z.infer<typeof CertificationItemSchema>;

export const LanguageItemSchema = z.object({
  name: z.string(),
  proficiency: z.string().optional(),
});

export type LanguageItem = z.infer<typeof LanguageItemSchema>;

export const ProfileImageSchema = z.object({
  url: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
});

export type ProfileImage = z.infer<typeof ProfileImageSchema>;

export const LinkedInProfileResponseSchema = z.object({
  vanityId: z.string(),
  profileUrl: z.string(),
  fullName: z.string(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  headline: z.string().optional(),
  location: z.string().optional(),
  about: z.string().optional(),
  profilePicture: z.string().optional(),
  backgroundPicture: z.string().optional(),
  experiences: z.array(ExperienceItemSchema).default([]),
  education: z.array(EducationItemSchema).default([]),
  skills: z.array(SkillItemSchema).default([]),
  certifications: z.array(CertificationItemSchema).default([]),
  languages: z.array(LanguageItemSchema).default([]),
});

export type LinkedInProfileResponse = z.infer<typeof LinkedInProfileResponseSchema>;
