
"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useAchievements } from '@/context/AchievementsContext';
import { useChallengeConfig } from '@/context/ChallengeConfigContext';
import { User, CertificateStatus, STATUS_CONFIG } from '@/lib/config';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Loader2, ArrowLeft, BarChart as BarChartIcon, PieChart as PieChartIcon, LineChart as LineChartIcon, Calendar as CalendarIcon } from 'lucide-react';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig } from "@/components/ui/chart"
import { Bar, BarChart, XAxis, YAxis, CartesianGrid, Pie, PieChart, Line, LineChart, Cell } from "recharts"
import { collection, query, where, getDocs, Timestamp, orderBy, DocumentData } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { subDays, format, eachDayOfInterval, startOfDay, endOfDay } from 'date-fns';
import { ko } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Skeleton } from '@/components/ui/skeleton';

const pieChartConfig = {
  students: {
    label: "학생 수",
  },
  Gold: {
    label: "금장",
    color: "hsl(var(--chart-4))",
  },
  Silver: {
    label: "은장",
    color: "hsl(var(--chart-3))",
  },
  Bronze: {
    label: "동장",
    color: "hsl(var(--chart-5))",
  },
  Unranked: {
    label: "미인증",
    color: "hsl(var(--muted))",
  },
} satisfies ChartConfig;

const barChartConfig = {
  count: {
    label: "활동 학생 수",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig;

const lineChartConfig = {
  submissions: {
    label: "제출 수",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig

export default function StatsPage() {
  const { user, users, loading: authLoading, usersLoading } = useAuth();
  const { certificateStatus } = useAchievements();
  const { challengeConfig, loading: configLoading } = useChallengeConfig();
  const router = useRouter();

  const [timeRangeSubmissions, setTimeRangeSubmissions] = useState<DocumentData[]>([]);
  const [dailySubmissions, setDailySubmissions] = useState<any[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(true);
  const [date, setDate] = useState<DateRange | undefined>({
    from: subDays(new Date(), 29),
    to: new Date(),
  });


  useEffect(() => {
    if (!authLoading && user?.role !== 'teacher') {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!db || !date?.from) {
        setSubmissionsLoading(false);
        return;
    };
    const fetchSubmissions = async () => {
      setSubmissionsLoading(true);

      const startDate = startOfDay(date.from!);
      const endDate = endOfDay(date.to || date.from!);
      
      const q = query(
        collection(db, "challengeSubmissions"),
        where("createdAt", ">=", Timestamp.fromDate(startDate)),
        where("createdAt", "<=", Timestamp.fromDate(endDate)),
        orderBy("createdAt", "asc")
      );

      try {
        const querySnapshot = await getDocs(q);
        const allSubmissions = querySnapshot.docs.map(doc => doc.data());
        setTimeRangeSubmissions(allSubmissions);

        const submissionsByDay: { [key: string]: number } = {};
        allSubmissions.forEach(data => {
          const submissionDate = (data.createdAt as Timestamp).toDate();
          const formattedDate = format(submissionDate, 'yyyy-MM-dd');
          submissionsByDay[formattedDate] = (submissionsByDay[formattedDate] || 0) + 1;
        });

        const intervalDays = eachDayOfInterval({
          start: startDate,
          end: endDate,
        });

        const chartData = intervalDays.map(day => {
          const formattedDate = format(day, 'yyyy-MM-dd');
          return {
            date: format(day, 'M/d'),
            submissions: submissionsByDay[formattedDate] || 0,
          };
        });

        setDailySubmissions(chartData);
      } catch (error) {
        console.error("Error fetching submission data for chart:", error);
      } finally {
        setSubmissionsLoading(false);
      }
    };

    fetchSubmissions();
  }, [date]);

  if (authLoading || usersLoading || configLoading || !user || !challengeConfig) {
    return <div className="flex h-screen w-full items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;
  }

  // --- DATA CALCULATIONS BASED ON DATE RANGE ---
  const activeStudentUsernames = [...new Set(timeRangeSubmissions.map(sub => sub.userId))];
  const activeStudentUsers = users.filter(u => u.role === 'student' && activeStudentUsernames.includes(u.username));

  // Data for Pie Chart
  const certificateStatusData = activeStudentUsers.reduce((acc, student) => {
    const status = certificateStatus(student.username);
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<CertificateStatus, number>);
  
  const pieChartData = Object.entries(certificateStatusData).map(([status, count]) => ({
      status,
      students: count,
      fill: `var(--color-${status})`,
  })).sort((a,b) => {
      const order = ['Gold', 'Silver', 'Bronze', 'Unranked'];
      return order.indexOf(a.status) - order.indexOf(b.status);
  });

  // Data for Bar Chart
  const certificationsPerAreaData = Object.keys(challengeConfig).map(areaName => {
    const approvedSubmissionsInArea = timeRangeSubmissions.filter(sub => sub.areaName === areaName && sub.status === 'approved');
    const uniqueStudentCount = new Set(approvedSubmissionsInArea.map(sub => sub.userId)).size;
    return {
      area: challengeConfig[areaName].koreanName,
      count: uniqueStudentCount,
    };
  }).sort((a, b) => b.count - a.count);


  return (
    <div className="container mx-auto px-4 py-8">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 pb-4 border-b">
        <h1 className="text-2xl sm:text-3xl font-bold font-headline text-primary flex items-center gap-2"><BarChartIcon/> 학생 참여 현황</h1>
        <div className="flex items-center gap-2 flex-wrap justify-end">
            <Popover>
                <PopoverTrigger asChild>
                <Button
                    variant={"outline"}
                    className={cn(
                    "w-full sm:w-[280px] justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                    )}
                >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date?.from ? (
                    date.to ? (
                        <>
                        {format(date.from, "yyyy/MM/dd")} - {format(date.to, "yyyy/MM/dd")}
                        </>
                    ) : (
                        format(date.from, "yyyy/MM/dd")
                    )
                    ) : (
                    <span>날짜를 선택하세요</span>
                    )}
                </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={date?.from}
                    selected={date}
                    onSelect={setDate}
                    numberOfMonths={2}
                    locale={ko}
                />
                </PopoverContent>
            </Popover>
            <Button asChild variant="outline" className="self-end sm:self-auto">
                <Link href="/admin">
                    <ArrowLeft className="mr-2"/> 학생 관리로
                </Link>
            </Button>
        </div>
      </header>

    {submissionsLoading ? (
        <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card><CardHeader><Skeleton className="h-8 w-3/4" /></CardHeader><CardContent><Skeleton className="aspect-square max-h-[250px] mx-auto rounded-full" /></CardContent><CardFooter><Skeleton className="h-12 w-full" /></CardFooter></Card>
                <Card><CardHeader><Skeleton className="h-8 w-3/4" /></CardHeader><CardContent><Skeleton className="w-full h-[350px]" /></CardContent></Card>
            </div>
             <Card className="mt-8"><CardHeader><Skeleton className="h-8 w-1/4" /></CardHeader><CardContent><Skeleton className="w-full h-[350px]" /></CardContent></Card>
        </>
    ) : (
        <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><PieChartIcon/> 기간 내 활동 학생 등급 분포</CardTitle>
            <CardDescription>선택한 기간 동안 활동한 학생들의 현재 인증 등급입니다.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 pb-0">
            {activeStudentUsers.length === 0 ? (
                 <div className="flex items-center justify-center h-full min-h-[250px] text-muted-foreground">
                    해당 기간에 활동한 학생이 없습니다.
                </div>
            ) : (
            <ChartContainer
              config={pieChartConfig}
              className="mx-auto aspect-square max-h-[250px]"
            >
              <PieChart>
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent hideLabel />}
                />
                <Pie
                  data={pieChartData}
                  dataKey="students"
                  nameKey="status"
                  innerRadius={60}
                  strokeWidth={5}
                >
                  {pieChartData.map((entry) => (
                    <Cell
                      key={`cell-${entry.status}`}
                      fill={entry.fill}
                      className="stroke-background hover:opacity-80"
                    />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
            )}
          </CardContent>
          <CardFooter className="flex-col gap-2 text-sm pt-4">
            <div className="w-full grid grid-cols-2 gap-x-8 gap-y-2">
              {pieChartData.map((entry) => {
                const statusInfo = STATUS_CONFIG[entry.status as CertificateStatus];
                if (!statusInfo) return null;
                
                return (
                  <div key={entry.status} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: entry.fill }}
                      />
                      <span className="text-muted-foreground">{statusInfo.label}</span>
                    </div>
                    <span className="font-bold tabular-nums">
                      {entry.students}명
                    </span>
                  </div>
                )
              })}
            </div>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BarChartIcon/> 기간 내 영역별 활동 학생 수</CardTitle>
            <CardDescription>선택한 기간 동안 각 영역에서 승인된 활동을 제출한 학생 수입니다.</CardDescription>
          </CardHeader>
          <CardContent>
             <ChartContainer config={barChartConfig} className="w-full h-[350px]">
                <BarChart
                  data={certificationsPerAreaData}
                  layout="vertical"
                  margin={{ left: 10, right: 10 }}
                >
                  <CartesianGrid horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="area"
                    type="category"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={10}
                    width={80}
                  />
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent hideLabel />}
                  />
                  <Bar dataKey="count" fill="var(--color-count)" radius={5} />
                </BarChart>
              </ChartContainer>
          </CardContent>
        </Card>
      </div>

       <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><LineChartIcon/> 일별 활동 제출 수</CardTitle>
            <CardDescription>선택한 기간 동안 제출된 전체 활동 수의 변화입니다.</CardDescription>
          </CardHeader>
          <CardContent>
             <ChartContainer config={lineChartConfig} className="w-full h-[350px]">
                <LineChart data={dailySubmissions}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis allowDecimals={false} />
                  <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                  <Line dataKey="submissions" type="monotone" stroke="var(--color-submissions)" strokeWidth={2} dot={false} />
                </LineChart>
              </ChartContainer>
          </CardContent>
        </Card>
      </>
    )}
    </div>
  );
}
