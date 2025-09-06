'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from '@/hooks/use-toast';
import { MessageSquare, Paperclip, Send, Image as ImageIcon } from 'lucide-react';
import { FeedbackItem } from '@/lib/types';
import { useTimetable } from '@/context/TimetableProvider';
import { Skeleton } from '@/components/ui/skeleton';

const feedbackSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters long.' }),
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  description: z.string().min(10, { message: 'Description must be at least 10 characters long.' }),
  images: z.any().optional(),
});

export default function ReviewPage() {
  const { toast } = useToast();
  const { setFeedbackItems } = useTimetable();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const form = useForm<z.infer<typeof feedbackSchema>>({
    resolver: zodResolver(feedbackSchema),
    defaultValues: {
      name: '',
      email: '',
      description: '',
    },
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      setSelectedFiles(Array.from(files));
      form.setValue('images', files);
    }
  };

  const onSubmit = async (data: z.infer<typeof feedbackSchema>) => {
    const imagePromises = selectedFiles.map((file) => {
      return new Promise<{ name: string; url: string }>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target?.result) {
            resolve({ name: file.name, url: event.target.result as string });
          } else {
            reject(new Error('Failed to read file.'));
          }
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    });

    try {
      const images = await Promise.all(imagePromises);
      const newFeedback: FeedbackItem = {
        id: Date.now().toString(),
        name: data.name,
        email: data.email,
        description: data.description,
        images,
      };

      setFeedbackItems((prev) => [newFeedback, ...prev]);
      toast({
        title: 'Feedback Submitted',
        description: 'Thank you! Your feedback has been sent to the admin for review.',
      });
      form.reset();
      setSelectedFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error Submitting Feedback',
        description: 'There was an issue with one of the attachments.',
      });
    }
  };

  if (!isClient) {
    return (
      <div className="container mx-auto p-4 md:p-6 lg:p-8">
        <div className="mb-8">
          <Skeleton className="h-10 w-1/2 mb-2" />
          <Skeleton className="h-6 w-1/3" />
        </div>
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <Skeleton className="h-7 w-1/3" />
              <Skeleton className="h-5 w-2/3" />
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="space-y-2">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-20 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-10 w-40" />
              </div>
              <div className="flex justify-end">
                <Skeleton className="h-10 w-36" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto w-fit p-4 md:p-6 lg:p-8">
      <div className="mb-8 w-full ">
        <h1 className="text-4xl font-bold font-headline mb-2 flex items-center">
          <MessageSquare className="mr-3 h-10 w-10 text-primary" />
          Submit Feedback
        </h1>
        <p className="text-lg text-muted-foreground">Report issues or give feedback.</p>
      </div>

      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center"><MessageSquare className="mr-2 h-6 w-6"/>Feedback Form</CardTitle>
            <CardDescription>Have feedback or found an issue? Let us know.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Your Name</FormLabel>
                      <FormControl>
                        <Input type="text" placeholder="John Doe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Your Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="you@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Feedback / Description</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Please describe your feedback or the issue in detail..." {...field} rows={5} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end">
                  <Button type="submit">
                    <Send className="mr-2 h-4 w-4" />
                    Submit Feedback
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
