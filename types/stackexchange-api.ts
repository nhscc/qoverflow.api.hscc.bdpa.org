import { Opaque } from 'type-fest';

export type EpochTimeInSeconds = Opaque<number, 'EpochTimeInSeconds'>;
export type SecondsFromNow = Opaque<number, 'SecondsFromNow'>;
export type UriString = Opaque<string, 'UriString'>;

export type StackExchangeQuestion = {
  tags: string[];
  owner: StackExchangeUser;
  is_answered: boolean;
  view_count: number;
  protected_date: EpochTimeInSeconds;
  accepted_answer_id: number;
  answer_count: number;
  score: number;
  last_activity_date: EpochTimeInSeconds;
  creation_date: EpochTimeInSeconds;
  last_edit_date: EpochTimeInSeconds;
  question_id: number;
  content_license: string;
  link: UriString;
  title: string;
  body: string;
};

export type StackExchangeAnswer = {
  owner: StackExchangeUser;
  is_accepted: boolean;
  score: number;
  last_activity_date: EpochTimeInSeconds;
  last_edit_date: EpochTimeInSeconds;
  creation_date: EpochTimeInSeconds;
  answer_id: number;
  question_id: number;
  content_license: string;
  body: string;
};

export type StackExchangeComment = {
  owner: StackExchangeUser;
  edited: boolean;
  score: number;
  creation_date: EpochTimeInSeconds;
  post_id: number;
  comment_id: number;
  content_license: string;
  body: string;
};

export type StackExchangeUser = {
  account_id: number;
  reputation: number;
  user_id: number;
  user_type: string;
  accept_rate: number;
  profile_image: UriString;
  display_name: string;
  link: UriString;
};

export type StackExchangeApiResponse<T> = {
  backoff?: SecondsFromNow;
  error_id?: number;
  error_message?: string;
  error_name?: string;
  has_more: boolean;
  items: T[];
  quota_max: number;
  quota_remaining: number;
};
