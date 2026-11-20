import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  Index,
  JoinColumn,
} from 'typeorm';
import { AccountStatus, UserRole, Gender } from './role.enum';
import { Exclude } from 'class-transformer';

@Entity('profiles')
export class Profile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text', nullable: true })
  bio: string;

  @Column({ nullable: true })
  dateOfBirth: Date;

  @Column({ nullable: true })
  gender: string;

  @Column({ nullable: true })
  avatarUrl: string;

  @Column({ type: 'uuid', nullable: true })
  userId: string;

  @OneToOne('User', (user: any) => user.profile)
  user: any;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('addresses')
export class Address {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  label: string;

  @Column({ type: 'varchar', nullable: true })
  recipientName: string | null;

  @Column({ type: 'varchar', nullable: true })
  phone: string | null;

  @Column()
  street: string;

  @Column({ nullable: true })
  complement: string;

  @Column()
  city: string;

  @Column()
  state: string;

  @Column()
  country: string;

  @Column()
  postalCode: string;

  @Column({ default: false })
  isDefault: boolean;

  @Column({ type: 'varchar', nullable: true })
  instructions: string | null;

  @Column({ type: 'uuid' })
  @Index()
  userId: string;

  @ManyToOne('User', (user: any) => user.addresses)
  @JoinColumn({ name: 'userId' })
  user: any;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  @Index()
  email: string;

  @Column()
  @Exclude()
  passwordHash: string;

  @Column({ nullable: true })
  firstName: string;

  @Column({ nullable: true })
  lastName: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  avatarUrl: string;

  @Column({ type: 'date', nullable: true })
  birthDate: string | null;

  @Column({ type: 'enum', enum: Gender, default: Gender.UNSPECIFIED })
  gender: Gender;

  @Column({ default: false })
  marketingOptIn: boolean;

  @Column({ type: 'timestamp', nullable: true })
  marketingOptInAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  termsAcceptedAt: Date | null;

  @Column({ default: true })
  notifyFollowedShopProducts: boolean;

  @Column({ default: true })
  notifyFollowedShopPromotions: boolean;

  @Column({ default: true })
  notifyMessagesByEmail: boolean;

  @Column({
    type: 'simple-array',
    default: UserRole.CLIENT,
  })
  @Index()
  roles: UserRole[];

  @Column({
    type: 'enum',
    enum: AccountStatus,
    default: AccountStatus.PENDING_VERIFICATION,
  })
  @Index()
  status: AccountStatus;

  @Column({ nullable: true })
  @Exclude()
  refreshTokenHash?: string;

  @Column({ default: false })
  emailVerified: boolean;

  @Column({ nullable: true })
  emailVerifiedAt: Date;

  @Column({ nullable: true })
  @Exclude()
  emailVerificationToken?: string;

  @Column({ type: 'timestamp', nullable: true })
  emailVerificationTokenExpiresAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastVerificationEmailSentAt?: Date;

  @Column({ nullable: true })
  passwordChangedAt: Date;

  @Column({ type: 'int', default: 0 })
  failedLoginAttempts: number;

  @Column({ type: 'timestamp', nullable: true })
  lockedUntil?: Date;

  @Column({ nullable: true })
  phoneVerifiedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  sellerRequestedAt?: Date | null;

  @Column({
    type: 'decimal',
    precision: 3,
    scale: 2,
    default: 0,
    transformer: { to: (value?: number) => value ?? 0, from: (value: string | null) => Number(value ?? 0) },
  })
  reputationScore: number;

  @Column({ default: 0 })
  reviewCount: number;

  @Column({ nullable: true })
  lastLoginAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;

  @OneToOne(() => Profile, (profile) => profile.user, { cascade: true })
  profile: Profile;

  @OneToMany(() => Address, (address) => address.user)
  addresses: Address[];
}
