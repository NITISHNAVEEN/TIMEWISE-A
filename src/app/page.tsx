import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Logo } from "@/components/timewise/Logo";
import { ArrowRight, CalendarCheck, Users, School } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <nav className="flex items-center justify-center">
          <Link href="/" className="flex items-center gap-0 font-bold text-lg border-gray-800 rounded-sm">
            <Logo className="h-8 w-full text-black" />
            <span className="font-headline text-3xl text-black w-full p-2">TimeWise</span>
          </Link>
        </nav>
      </header>
      <main className="flex-grow">
        <section className="bg-[#D2E0FB] border-black md:border-none rounded-3xl md:animated-gradient-button md:rounded-[400px_/_400px] mx-4 px-4 sm:px-6 lg:px-8 text-center py-20 md:py-32">
          <h1 className="text-5xl md:text-6xl font-extrabold font-headline tracking-tighter leading-tight mb-4 text-foreground">
            Intelligent Timetable Scheduling
          </h1>
          <p className="text-lg md:text-xl text-gray-800 max-w-3xl mx-auto mb-8 leading-relaxed">
          TimeWise harnesses intelligent algorithms to generate conflict-free timetables, all within a centralized and user-friendly interface.
          </p>
          <Button size="lg" className="font-semibold bg-[#0C0950] " asChild>
            <Link href="/dashboard/home">
              Get Started
            </Link>
          </Button>
        </section>

        <section className="bg-secondary/50 py-20">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
              <Card className="bg-card backdrop-blur-sm border-border/50 shadow-lg hover:shadow-primary/20 hover:border-primary/50 transition-all duration-300">
                <CardContent className="p-8">
                  <div className="p-4 bg-primary/10 rounded-full inline-block mb-4">
                    <CalendarCheck className="h-10 w-10 text-primary" />
                  </div>
                  <h3 className="text-xl font-headline font-semibold mb-2 text-foreground">AI-Powered Conflict Resolution</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Let our AI identify scheduling clashes and provide smart, actionable suggestions to resolve them, ensuring a seamless timetable.
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-card backdrop-blur-sm border-border/50 shadow-lg hover:shadow-primary/20 hover:border-primary/50 transition-all duration-300">
                <CardContent className="p-8">
                  <div className="p-4 bg-primary/10 rounded-full inline-block mb-4">
                    <Users className="h-10 w-10 text-primary" />
                  </div>
                  <h3 className="text-xl font-headline font-semibold mb-2 text-foreground">Role-Based Views</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Provide tailored, easy-to-access timetables for administrators, faculty, and students.
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-card backdrop-blur-sm border-border/50 shadow-lg hover:shadow-primary/20 hover:border-primary/50 transition-all duration-300">
                <CardContent className="p-8">
                  <div className="p-4 bg-primary/10 rounded-full inline-block mb-4">
                     <School className="h-10 w-10 text-primary" />
                  </div>
                  <h3 className="text-xl font-headline font-semibold mb-2 text-foreground">Real-Time Updates</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Instantly reflect changes across the entire system, ensuring everyone is always up-to-date.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </main>
      <footer className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} TimeWise. All rights reserved.</p>
      </footer>
    </div>
  );
}
