"use client";

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useAchievements } from '@/context/AchievementsContext';
import { useChallengeConfig } from '@/context/ChallengeConfigContext';
import { User, CertificateStatus, STATUS_CONFIG } from '@/lib/config';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Loader2, ArrowLeft, BarChart as BarChartIcon, PieChart as PieChartIcon, LineChart as LineChartIcon, Calendar as CalendarIcon, Percent } from 'lucide-react';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig } from "@/components/ui/chart"
import { Bar, BarChart, XAxis, YAxis, CartesianGrid, Pie, PieChart, Line, LineChart, Cell } from "recharts"
import { collection, query, where, getDocs, Timestamp, orderBy, DocumentData } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { subDays, format, eachDayOfInterval, startOfDay, endOfDay, eachWeekOfInterval, startOfWeek, eachMonthOfInterval, startOfMonth } from 'date-fns';
import { ko } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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

const participationChartConfig = {
    rate: {
        label: "참여율 (%)",
        color: "hsl(var(--chart-2))",
    },
} satisfies ChartConfig;

export default function StatsPage() {
  const { user, users, loading: authLoading, usersLoading } = useAuth();
  const { certificateStatus } = useAchievements();
  const { challengeConfig, loading: configLoading } = useChallengeConfig();
  const router = useRouter();

  const [timeRangeSubmissions, setTimeRangeSubmissions] = useState<DocumentData[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(true);
  const [date, setDate] = useState<DateRange | undefined>({
    from: subDays(new Date(), 29),
    to: new Date(),
  });
  
  const [gradeFilter, setGradeFilter] = useState<string>('all');
  const [classFilter, setClassFilter] = useState<string>('all');


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

      } catch (error) {
        console.error("Error fetching submission data for chart:", error);
      } finally {
        setSubmissionsLoading(false);
      }
    };

    fetchSubmissions();
  }, [date]);
  
  const allStudentUsers = useMemo(() => users.filter(u => u.role === 'student'), [users]);
  const availableGrades = useMemo(() => [...new Set(allStudentUsers.map(u => u.grade))].sort((a,b) => (a ?? 0) - (b ?? 0)), [allStudentUsers]);
  const studentsForClassList = useMemo(() => allStudentUsers.filter(u => gradeFilter === 'all' || u.grade === parseInt(gradeFilter, 10)), [allStudentUsers, gradeFilter]);
  const availableClasses = useMemo(() => [...new Set(studentsForClassList.map(u => u.classNum))].sort((a,b) => (a ?? 0) - (b ?? 0)), [studentsForClassList]);

  useEffect(() => {
    setClassFilter('all');
  }, [gradeFilter]);

  const filteredStudents = useMemo(() => {
    return allStudentUsers.filter(u => {
        const gradeMatch = gradeFilter === 'all' || u.grade === parseInt(gradeFilter, 10);
        const classMatch = classFilter === 'all' || u.classNum === parseInt(classFilter, 10);
        return gradeMatch && classMatch;
    });
  }, [allStudentUsers, gradeFilter, classFilter]);
  
  const totalStudentsCount = filteredStudents.length;

  const filteredSubmissions = useMemo(() => {
    const filteredUsernames = new Set(filteredStudents.map(u => u.username));
    return timeRangeSubmissions.filter(sub => filteredUsernames.has(sub.userId));
  }, [timeRangeSubmissions, filteredStudents]);
  
  // Data for Pie Chart
  const pieChartData = useMemo(() => {
    const activeUsernames = new Set(filteredSubmissions.map(sub => sub.userId));
    const activeStudents = filteredStudents.filter(u => activeUsernames.has(u.username));
    
    if (activeStudents.length === 0) return [];
    
    const statusCounts = activeStudents.reduce((acc, student) => {
      const status = certificateStatus(student.username);
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<CertificateStatus, number>);
    
    return Object.entries(statusCounts).map(([status, count]) => ({
        status,
        students: count,
        fill: `var(--color-${status})`,
    })).sort((a,b) => {
        const order = ['Gold', 'Silver', 'Bronze', 'Unranked'];
        return order.indexOf(a.status) - order.indexOf(b.status);
    });
  }, [filteredSubmissions, filteredStudents, certificateStatus]);


  // Data for Bar Chart
  const barChartData = useMemo(() => {
      if (!challengeConfig) return [];
      return Object.keys(challengeConfig).map(areaName => {
          const approvedSubmissionsInArea = filteredSubmissions.filter(sub => sub.areaName === areaName && sub.status === 'approved');
          const uniqueStudentCount = new Set(approvedSubmissionsInArea.map(sub => sub.userId)).size;
          return {
            area: challengeConfig[areaName].koreanName,
            count: uniqueStudentCount,
          };
      }).sort((a, b) => b.count - a.count);
  }, [challengeConfig, filteredSubmissions]);

  // Data for Line Chart
  const lineChartData = useMemo(() => {
      if (!date?.from) return [];
      const startDate = startOfDay(date.from);
      const endDate = endOfDay(date.to || date.from);
      const submissionsByDay: { [key: string]: number } = {};
      
      filteredSubmissions.forEach(data => {
          const submissionDate = (data.createdAt as Timestamp).toDate();
          const formattedDate = format(submissionDate, 'yyyy-MM-dd');
          submissionsByDay[formattedDate] = (submissionsByDay[formattedDate] || 0) + 1;
      });

      const intervalDays = eachDayOfInterval({ start: startDate, end: endDate });
      return intervalDays.map(day => ({
          date: format(day, 'M/d'),
          submissions: submissionsByDay[format(day, 'yyyy-MM-dd')] || 0,
      }));
  }, [date, filteredSubmissions]);
  
  // Data for Participation Rate Chart
  const participationRateData = useMemo(() => {
    if (!date?.from || totalStudentsCount === 0) return { daily: [], weekly: [], monthly: [] };

    const startDate = startOfDay(date.from);
    const endDate = endOfDay(date.to || date.from);

    // Daily
    const dailyActiveUsers = new Map<string, Set<string>>();
    filteredSubmissions.forEach(sub => {
        const dayKey = format((sub.createdAt as Timestamp).toDate(), 'yyyy-MM-dd');
        if (!dailyActiveUsers.has(dayKey)) dailyActiveUsers.set(dayKey, new Set());
        dailyActiveUsers.get(dayKey)!.add(sub.userId);
    });
    const daily = eachDayOfInterval({ start: startDate, end: endDate }).map(day => {
        const dayKey = format(day, 'yyyy-MM-dd');
        const activeCount = dailyActiveUsers.get(dayKey)?.size || 0;
        return {
            date: format(day, 'M/d'),
            rate: parseFloat(((activeCount / totalStudentsCount) * 100).toFixed(1)),
        };
    });

    // Weekly
    const weeklyActiveUsers = new Map<string, Set<string>>();
    filteredSubmissions.forEach(sub => {
        const weekKey = format(startOfWeek((sub.createdAt as Timestamp).toDate(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
        if (!weeklyActiveUsers.has(weekKey)) weeklyActiveUsers.set(weekKey, new Set());
        weeklyActiveUsers.get(weekKey)!.add(sub.userId);
    });
    const weekly = eachWeekOfInterval({ start: startDate, end: endDate }, { weekStartsOn: 1 }).map(weekStart => {
        const activeCount = weeklyActiveUsers.get(format(weekStart, 'yyyy-MM-dd'))?.size || 0;
        return {
            week: `${format(weekStart, 'M/d')}주`,
            rate: parseFloat(((activeCount / totalStudentsCount) * 100).toFixed(1)),
        };
    });

    // Monthly
    const monthlyActiveUsers = new Map<string, Set<string>>();
    filteredSubmissions.forEach(sub => {
        const monthKey = format(startOfMonth((sub.createdAt as Timestamp).toDate()), 'yyyy-MM-dd');
        if (!monthlyActiveUsers.has(monthKey)) monthlyActiveUsers.set(monthKey, new Set());
        monthlyActiveUsers.get(monthKey)!.add(sub.userId);
    });
    const monthly = eachMonthOfInterval({ start: startDate, end: endDate }).map(monthStart => {
        const activeCount = monthlyActiveUsers.get(format(monthStart, 'yyyy-MM-dd'))?.size || 0;
        return {
            month: format(monthStart, 'yy년 M월'),
            rate: parseFloat(((activeCount / totalStudentsCount) * 100).toFixed(1)),
        };
    });

    return { daily, weekly, monthly };

  }, [date, filteredSubmissions, totalStudentsCount]);

  if (authLoading || usersLoading || configLoading || !user || !challengeConfig) {
    return <div className="flex h-screen w-full items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;
  }
  
  return (
    <div className="container mx-auto px-4 py-8">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 pb-4 border-b">
        <h1 className="text-2xl sm:text-3xl font-bold font-headline text-primary flex items-center gap-2"><BarChartIcon/> 학생 참여 현황</h1>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <Select value={gradeFilter} onValueChange={setGradeFilter}>
            <SelectTrigger className="w-full sm:w-[120px] h-9">
                <SelectValue placeholder="학년" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="all">전체 학년</SelectItem>
                {availableGrades.map(grade => (
                    grade != null && <SelectItem key={grade} value={String(grade)}>{grade}학년</SelectItem>
                ))}
            </SelectContent>
          </Select>
          <Select value={classFilter} onValueChange={setClassFilter} disabled={availableClasses.length === 0}>
              <SelectTrigger className="w-full sm:w-[120px] h-9">
                  <SelectValue placeholder="반" />
              </SelectTrigger>
              <SelectContent>
                  <SelectItem value="all">전체 반</SelectItem>
                  {availableClasses.map(classNum => (
                      classNum != null && <SelectItem key={classNum} value={String(classNum)}>{classNum}반</SelectItem>
                  ))}
              </SelectContent>
          </Select>
          <Popover>
              <PopoverTrigger asChild>
              <Button
                  id="date"
                  variant={"outline"}
                  className={cn(
                  "w-full sm:w-[280px] justify-start text-left font-normal h-9",
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
          <Button asChild variant="outline" className="self-end sm:self-auto h-9">
              <Link href="/admin">
                  <ArrowLeft className="mr-2"/> 학생 관리로
              </Link>
          </Button>
        </div>
      </header>

      {submissionsLoading ? (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
              <Card><CardHeader><Skeleton className="h-8 w-3/4" /></CardHeader><CardContent><Skeleton className="aspect-square max-h-[250px] mx-auto rounded-full" /></CardContent><CardFooter><Skeleton className="h-12 w-full" /></CardFooter></Card>
              <Card><CardHeader><Skeleton className="h-8 w-3/4" /></CardHeader><CardContent><Skeleton className="w-full h-[350px]" /></CardContent></Card>
              <Card className="lg:col-span-2"><CardHeader><Skeleton className="h-8 w-1/4" /></CardHeader><CardContent><Skeleton className="w-full h-[350px]" /></CardContent></Card>
              <Card className="lg:col-span-2"><CardHeader><Skeleton className="h-8 w-1/4" /></CardHeader><CardContent><Skeleton className="w-full h-[400px]" /></CardContent></Card>
          </div>
      ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card className="flex flex-col">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><PieChartIcon/> 기간 내 활동 학생 등급 분포</CardTitle>
                  <CardDescription>선택한 기간 동안 활동한 학생들의 현재 인증 등급입니다.</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 pb-0">
                  {pieChartData.length === 0 ? (
                      <div className="flex items-center justify-center h-full min-h-[250px] text-muted-foreground">
                          해당 기간/조건에 활동한 학생이 없습니다.
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
                {pieChartData.length > 0 && 
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
                }
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><BarChartIcon/> 기간 내 영역별 활동 학생 수</CardTitle>
                  <CardDescription>선택한 기간 동안 각 영역에서 승인된 활동을 제출한 학생 수입니다.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={barChartConfig} className="w-full h-[350px]">
                      <BarChart
                        data={barChartData}
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
                  <CardTitle className="flex items-center gap-2"><LineChartIcon/> 기간 내 일별 활동 제출 수</CardTitle>
                  <CardDescription>선택한 기간 동안 제출된 전체 활동 수의 변화입니다.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={lineChartConfig} className="w-full h-[350px]">
                      <LineChart data={lineChartData}>
                        <CartesianGrid vertical={false} />
                        <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
                        <YAxis allowDecimals={false} />
                        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                        <Line dataKey="submissions" type="monotone" stroke="var(--color-submissions)" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ChartContainer>
                </CardContent>
            </Card>

            <Card className="mt-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Percent /> 학생 참여율</CardTitle>
                <CardDescription>
                  선택한 기간과 조건에 해당하는 전체 학생 중, 활동을 1회 이상 제출한 학생의 비율입니다.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="daily" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="daily">일별 참여율</TabsTrigger>
                    <TabsTrigger value="weekly">주별 참여율</TabsTrigger>
                    <TabsTrigger value="monthly">월별 참여율</TabsTrigger>
                  </TabsList>
                  <TabsContent value="daily" className="pt-4">
                    <ChartContainer config={participationChartConfig} className="w-full h-[400px]">
                      <BarChart data={participationRateData.daily}>
                        <CartesianGrid vertical={false} />
                        <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
                        <YAxis domain={[0, 100]} unit="%" />
                        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                        <Bar dataKey="rate" fill="var(--color-rate)" radius={4} />
                      </BarChart>
                    </ChartContainer>
                  </TabsContent>
                  <TabsContent value="weekly" className="pt-4">
                    <ChartContainer config={participationChartConfig} className="w-full h-[400px]">
                        <BarChart data={participationRateData.weekly}>
                          <CartesianGrid vertical={false} />
                          <XAxis dataKey="week" tickLine={false} axisLine={false} tickMargin={8} />
                          <YAxis domain={[0, 100]} unit="%" />
                          <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                          <Bar dataKey="rate" fill="var(--color-rate)" radius={4} />
                        </BarChart>
                      </ChartContainer>
                  </TabsContent>
                  <TabsContent value="monthly" className="pt-4">
                     <ChartContainer config={participationChartConfig} className="w-full h-[400px]">
                        <BarChart data={participationRateData.monthly}>
                          <CartesianGrid vertical={false} />
                          <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                          <YAxis domain={[0, 100]} unit="%" />
                          <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                          <Bar dataKey="rate" fill="var(--color-rate)" radius={4} />
                        </BarChart>
                      </ChartContainer>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </>
      )}
    </div>
  );
}
