"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { Check, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const INITIAL_SUBJECTS = [
  "Mathematics", "Physics", "Chemistry", "Biology",
  "Computer Science", "English", "History", "Geography"
];

interface SubjectFormProps {
  onComplete?: (subjects: string[]) => void;
  userId?: string;
}

export function SubjectForm({ onComplete, userId }: SubjectFormProps) {
  const { user: currentUser } = useUser();
  const [subjects, setSubjects] = useState<string[]>([]);
  const [newSubject, setNewSubject] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadSubjects = async () => {
      try {
        if (userId) {
          const response = await fetch(`/api/subjects?userId=${userId}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json'
            }
          });
          
          if (!response.ok) throw new Error('Failed to fetch subjects');
          
          const data = await response.json();
          setSubjects(data.subjects || []);
        } else if (currentUser) {
          const userSubjects = (currentUser.unsafeMetadata?.subjects as string[]) || [];
          setSubjects(userSubjects);
        }
      } catch (error) {
        console.error("Error loading subjects:", error);
        setSubjects([]);
      }
    };

    loadSubjects();
  }, [userId, currentUser]);

  const handleSave = async () => {
    try {
      setIsLoading(true);
      if (userId) {
        // Save subjects for other user
        const response = await fetch(`/api/subjects/${userId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subjects })
        });
        if (!response.ok) throw new Error('Failed to save subjects');
      } else {
        // Save subjects for current user
        await currentUser?.update({
          unsafeMetadata: { subjects }
        });
      }
      console.log("Saved subjects:", subjects);
      onComplete?.(subjects);
    } catch (error) {
      console.error("Error saving subjects:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Select Your Subjects</h2>
        <p className="text-sm text-muted-foreground">
          Choose the subjects you're interested in.
        </p>
      </div>

      {/* Common Subjects */}
      <div className="flex flex-wrap gap-2">
        {INITIAL_SUBJECTS.map((subject) => (
          <Button
            key={subject}
            variant={subjects.includes(subject) ? "default" : "outline"}
            size="sm"
            onClick={() => {
              if (subjects.includes(subject)) {
                setSubjects(subjects.filter(s => s !== subject));
              } else {
                setSubjects([...subjects, subject]);
              }
            }}
          >
            {subject}
            {subjects.includes(subject) && (
              <Check className="ml-2 h-4 w-4" />
            )}
          </Button>
        ))}
      </div>

      {/* Custom Subject Input */}
      <div className="flex gap-2">
        <Input
          placeholder="Add custom subject..."
          value={newSubject}
          onChange={(e) => setNewSubject(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter' && newSubject) {
              setSubjects([...subjects, newSubject]);
              setNewSubject("");
            }
          }}
        />
        <Button
          variant="outline"
          size="icon"
          onClick={() => {
            if (newSubject) {
              setSubjects([...subjects, newSubject]);
              setNewSubject("");
            }
          }}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Selected Subjects */}
      <div className="flex flex-wrap gap-2">
        {subjects.map((subject) => (
          <Badge
            key={subject}
            variant="secondary"
            className="flex items-center gap-1"
          >
            {subject}
            <button
              onClick={() => setSubjects(subjects.filter(s => s !== subject))}
              className="ml-1 hover:text-destructive"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>

      {/* Save Button */}
      <Button
        className="w-full"
        onClick={handleSave}
        disabled={isLoading}
      >
        {isLoading ? "Saving..." : "Save Subjects"}
      </Button>
    </div>
  );
} 