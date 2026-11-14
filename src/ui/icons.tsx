import {
  Activity,
  AlertTriangle,
  ArrowDownLeft,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  Award,
  Baby,
  Banknote,
  BookOpen,
  Briefcase,
  Building2,
  Calendar,
  Car,
  Check,
  ChevronDown,
  ChevronLeft,
  Compass,
  Coins,
  CreditCard,
  Dice5,
  Dumbbell,
  FileDown,
  FileUp,
  Flame,
  Gift,
  GraduationCap,
  Heart,
  HeartHandshake,
  Home,
  Info,
  Landmark,
  Lock,
  MapPin,
  Menu,
  Moon,
  Palette,
  Plane,
  Plus,
  RotateCcw,
  Share2,
  Shield,
  ShieldAlert,
  ShoppingBag,
  Sparkles,
  Star,
  Stethoscope,
  Sun,
  Trash2,
  TrendingDown,
  TrendingUp,
  Trophy,
  User,
  Users,
  Wallet,
  Wrench,
  X,
  type LucideProps,
} from 'lucide-react';

export function IconBrandMark({ className = 'h-7 w-7' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 36 36"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <rect width="36" height="36" rx="10" fill="var(--primary)" />
      <path
        d="M11 10.5C11 9.67 11.67 9 12.5 9H23.5C24.33 9 25 9.67 25 10.5V26.2C25 26.86 24.24 27.24 23.71 26.84L18 22.5L12.29 26.84C11.76 27.24 11 26.86 11 26.2V10.5Z"
        fill="var(--on-primary)"
        fillOpacity="0.95"
      />
      <circle cx="18" cy="15.5" r="2.6" fill="var(--primary)" />
    </svg>
  );
}

const withDefaultStroke = (Icon: React.ComponentType<LucideProps>) => {
  return function StyledIcon({ strokeWidth = 1.75, ...props }: LucideProps) {
    return <Icon strokeWidth={strokeWidth} {...props} />;
  };
};

export const IconNextYear = withDefaultStroke(Plus);
export const IconArrowUp = withDefaultStroke(ArrowUp);
export const IconCareerEdu = withDefaultStroke(Briefcase);
export const IconAssets = withDefaultStroke(Wallet);
export const IconRelations = withDefaultStroke(Users);
export const IconActivities = withDefaultStroke(Compass);
export const IconMenu = withDefaultStroke(Menu);
export const IconClose = withDefaultStroke(X);
export const IconBackRtl = withDefaultStroke(ArrowRight);
export const IconForwardRtl = withDefaultStroke(ArrowLeft);
export const IconChevronRtl = withDefaultStroke(ChevronLeft);
export const IconChevronDown = withDefaultStroke(ChevronDown);

export const IconHappiness = withDefaultStroke(Sun);
export const IconHealth = withDefaultStroke(Heart);
export const IconSmarts = withDefaultStroke(BookOpen);
export const IconLooks = withDefaultStroke(Sparkles);
export const IconMentalHealth = withDefaultStroke(Activity);
export const IconStanding = withDefaultStroke(Award);

export const IconEducation = withDefaultStroke(GraduationCap);
export const IconSkill = withDefaultStroke(Wrench);
export const IconShield = withDefaultStroke(Shield);
export const IconCrime = withDefaultStroke(ShieldAlert);
export const IconBank = withDefaultStroke(Landmark);
export const IconBuilding = withDefaultStroke(Building2);
export const IconHome = withDefaultStroke(Home);
export const IconCar = withDefaultStroke(Car);
export const IconCash = withDefaultStroke(Banknote);
export const IconCoins = withDefaultStroke(Coins);
export const IconCard = withDefaultStroke(CreditCard);
export const IconShop = withDefaultStroke(ShoppingBag);
export const IconTrendUp = withDefaultStroke(TrendingUp);
export const IconTrendDown = withDefaultStroke(TrendingDown);
export const IconArrowUpRight = withDefaultStroke(ArrowUpRight);
export const IconArrowDownLeft = withDefaultStroke(ArrowDownLeft);

export const IconPlane = withDefaultStroke(Plane);
export const IconSport = withDefaultStroke(Dumbbell);
export const IconGift = withDefaultStroke(Gift);
export const IconDoctor = withDefaultStroke(Stethoscope);
export const IconCharity = withDefaultStroke(HeartHandshake);
export const IconBaby = withDefaultStroke(Baby);
export const IconTrophy = withDefaultStroke(Trophy);
export const IconStar = withDefaultStroke(Star);
export const IconCalendar = withDefaultStroke(Calendar);
export const IconFlame = withDefaultStroke(Flame);
export const IconUser = withDefaultStroke(User);
export const IconPalette = withDefaultStroke(Palette);
export const IconSun = withDefaultStroke(Sun);
export const IconMoon = withDefaultStroke(Moon);
export const IconDice = withDefaultStroke(Dice5);
export const IconReset = withDefaultStroke(RotateCcw);
export const IconShare = withDefaultStroke(Share2);
export const IconExport = withDefaultStroke(FileDown);
export const IconImport = withDefaultStroke(FileUp);
export const IconTrash = withDefaultStroke(Trash2);
export const IconInfo = withDefaultStroke(Info);
export const IconLock = withDefaultStroke(Lock);
export const IconCheck = withDefaultStroke(Check);
export const IconWarning = withDefaultStroke(AlertTriangle);
export const IconSparkles = withDefaultStroke(Sparkles);
export const IconBook = withDefaultStroke(BookOpen);
export const IconHeart = withDefaultStroke(Heart);
export const IconMapPin = withDefaultStroke(MapPin);
