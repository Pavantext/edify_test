"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import Image from "next/image";
import { FileText, Download } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label as UILabel } from "@/components/ui/label";
import { ChevronDown } from "lucide-react";
import { X } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Settings } from "lucide-react";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { HelpCircle } from "lucide-react";
import { ReportButton } from "@/components/ReportButton";
import SubscriptionDialog from "@/components/SubscriptionDialog";

const formSchema = z.object({
  query: z.string().min(1, "Search query is required"),
  searchField: z.enum(["all", "title", "author"]).default("all"),
});

const summarySchema = z.object({
  summary: z.string(),
});

type SummaryType = z.infer<typeof summarySchema>;

type ResearchPaper = {
  id: string;
  title: string;
  authors: string[];
  abstract: string;
  downloadUrl?: string;
  year?: number;
  publishedDate?: string;
  venue?: string;
  language?: string;
  documentType: string;
};

type SummarySection = {
  id: string;
  label: string;
  description: string;
  defaultChecked: boolean;
};

type SearchFilters = {
  fields: string[];
  years: {
    min: string;
    max: string;
  };
  types: string[];
  authors: string[];
  languages: string[];
  documentTypes: string[];
};

const ITEMS_PER_PAGE = 10;

const MAX_PAPERS_SUMMARY = process.env.NEXT_PUBLIC_MAX_SUMMARY_PAPERS ?
  parseInt(process.env.NEXT_PUBLIC_MAX_SUMMARY_PAPERS) : 5; // Default to 5 papers

const documentTypeOptions = [
  { value: "thesis", label: "Thesis" },
  { value: "unknown", label: "Unknown" },
  { value: "research", label: "Research" },
  { value: "slides", label: "Slides" }
];

export default function ResearchPaperSearch() {
  const [papers, setPapers] = useState<ResearchPaper[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [scrollToken, setScrollToken] = useState<string | null>(null);
  const observer = useRef<IntersectionObserver | null>(null);
  const [currentQuery, setCurrentQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [summary, setSummary] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [batchNumber, setBatchNumber] = useState(0);
  const [totalBatches, setTotalBatches] = useState(0);
  const [loadedCount, setLoadedCount] = useState(0);
  const [totalResults, setTotalResults] = useState(0);
  const [selectedSections, setSelectedSections] = useState<Set<string>>(
    new Set([
      "overview",
      "keyfindings",
      "methods",
      "impact",
      "connections",
      "conclusion"
    ])
  );
  const [filters, setFilters] = useState<SearchFilters>({
    fields: [],
    years: { min: '', max: '' },
    types: [],
    authors: [],
    languages: [],
    documentTypes: []
  });
  const [yearRange, setYearRange] = useState<[number, number]>([1900, new Date().getFullYear()]);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectionStart, setSelectionStart] = useState(0);
  const [selectionEnd, setSelectionEnd] = useState(0);
  const [isLanguagePopoverOpen, setIsLanguagePopoverOpen] = useState(false);
  const [isDocTypePopoverOpen, setIsDocTypePopoverOpen] = useState(false);
  const [isYearPopoverOpen, setIsYearPopoverOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showSpecialCharWarning, setShowSpecialCharWarning] = useState(false);
  const [selectedSearchField, setSelectedSearchField] = useState<"all" | "title" | "author">("all");
  const [noMoreResults, setNoMoreResults] = useState(false);
  const [showSubscriptionDialog, setShowSubscriptionDialog] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      query: "",
    },
  });

  const summaryMutation = useMutation({
    mutationFn: async (papers: ResearchPaper[]) => {
      if (papers.length === 0) {
        toast.error("No papers to summarize");
        return "";
      }
      try {
        const response = await axios.post('/api/generate-summary', {
          papers: papers.slice(0, MAX_PAPERS_SUMMARY),
          sections: Array.from(selectedSections)
        });
        return response.data.summary;
      } catch (error) {
        console.error('Summary error:', error);
        toast.error("Failed to generate summary. Please try again.");
        return "";
      }
    }
  });

  const handleSearch = async (customQuery?: string, customFilters?: SearchFilters) => {
    // Early premium/usage check
    try {
      const res = await fetch("/api/check-premium", {
        method: "GET",
        headers: {
          'Content-Type': 'application/json'
        }
      });
      const data = await res.json();
      if (!data.premium && data.usageExceeded) {
        setShowSubscriptionDialog(true);
        return;
      }
    } catch (err) {
      console.error("Error checking premium status:", err);
    }

    setHasSearched(true);
    setNoMoreResults(false);
    const query = customQuery ?? form.getValues("query");
    const searchField = form.getValues("searchField");

    if (!query) {
      toast.error("Please enter a search query");
      return;
    }

    setSummary(null);
    setScrollToken(null);
    setBatchNumber(0);
    setLoadedCount(0);
    setHasMore(true);
    setLoading(true);

    try {
      const response = await fetch('/api/research-papers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          filters: customFilters ?? filters,
          batchNumber: 0,
          searchField
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 429) {
          toast.error("API Rate Limit Reached, please wait few seconds");
          return;
        }
        throw new Error(data.error || "CORE API Server Not Responding");
      }

      const transformedPapers = data.results.map(transformPaper);
      setPapers(transformedPapers);
      setScrollToken(data.scrollToken);
      setCurrentQuery(query);
      setTotalResults(data.totalHits);
      setLoadedCount(transformedPapers.length);
      setTotalBatches(Math.ceil(data.totalHits / 50));
      setBatchNumber(1);
      setHasMore(!!data.scrollToken);

      // Generate summary with the new papers directly
      if (transformedPapers.length > 0) {
        summaryMutation.mutate(transformedPapers, {
          onSuccess: (summary) => {
            if (summary) setSummary(summary);
          }
        });
      }
    } catch (error) {
      console.error('Search error:', error);
      if (axios.isAxiosError(error)) {
        if (error.response?.data?.error === "SCROLL_EXPIRED") {
          toast.error("Session expired. Starting a new search.");
          // The search will automatically restart from the beginning
        } else if (error.response?.status === 429) {
          toast.error("API Rate Limit Reached, please wait few seconds");
        } else {
          toast.error("Failed to perform search");
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const loadMore = useCallback(async () => {
    if (!scrollToken || isLoadingMore || !currentQuery || noMoreResults) return;

    setIsLoadingMore(true);
    try {
      const response = await axios.post("/api/research-papers", {
        query: currentQuery,
        scrollToken,
        batchNumber
      });

      if (response.data.results?.length > 0) {
        const newPapers = response.data.results.map(transformPaper);
        setPapers(prev => [...prev, ...newPapers]);
        setScrollToken(response.data.scrollToken);
        setBatchNumber(prev => prev + 1);
        setLoadedCount(prev => prev + newPapers.length);
      }

      // Check if there are no more results
      if (response.data.paginationInfo.noMoreResults || !response.data.scrollToken) {
        setNoMoreResults(true);
        setHasMore(false);
      } else {
        setHasMore(!!response.data.scrollToken);
      }
    } catch (error) {
      console.error('Load more error:', error);
      if (axios.isAxiosError(error)) {
        if (error.response?.data?.error === "SCROLL_EXPIRED") {
          toast.error("Scroll session expired. Please search again.", {
            action: {
              label: "Search Again",
              onClick: () => handleSearch(currentQuery)
            }
          });
          setHasMore(false);
          setScrollToken(null);
        } else if (error.response?.status === 429) {
          toast.error("API Rate Limit Reached, please wait few seconds");
        } else if (error.response?.status === 500) {
          toast.error("CORE API Server Not Responding");
        } else {
          toast.error("CORE API Server Not Responding");
        }
      }
    } finally {
      setIsLoadingMore(false);
    }
  }, [scrollToken, isLoadingMore, batchNumber, currentQuery, noMoreResults]); // handleSearch

  const lastPaperElementRef = useCallback((node: HTMLElement | null) => {
    if (!node || isLoadingMore || !hasMore) return;
    if (observer.current) observer.current.disconnect();

    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        loadMore();
      }
    }, { threshold: 0.1, rootMargin: '100px' });

    observer.current.observe(node);
  }, [isLoadingMore, hasMore, loadMore]);

  const transformPaper = (paper: any): ResearchPaper => ({
    id: paper.id,
    title: paper.title,
    authors: paper.authors?.map((author: any) => author.name) || [],
    abstract: paper.abstract || "No abstract available",
    downloadUrl: paper.downloadUrl,
    year: paper.yearPublished || paper.year,
    publishedDate: paper.publishedDate,
    venue: paper.publisher || (paper.journals?.[0]?.title) || "Venue not available",
    language: paper.language?.code || 'en',
    documentType: paper.documentType || "Unknown"
  });

  const filterPapers = (paper: ResearchPaper) => {
    // First apply publication year filter
    if (filters.years.min && filters.years.max) {
      const paperYear = paper.year || new Date(paper.publishedDate || "").getFullYear();
      if (paperYear < Number(filters.years.min) || paperYear > Number(filters.years.max)) {
        return false;
      }
    }

    // Then apply date filter
    const paperDate = new Date(paper.publishedDate || "");
    const now = new Date();

    switch (dateFilter) {
      case "recent": return paperDate > new Date(now.setMonth(now.getMonth() - 6));
      case "1y": return paperDate > new Date(now.setFullYear(now.getFullYear() - 1));
      case "5y": return paperDate > new Date(now.setFullYear(now.getFullYear() - 5));
      default: return true;
    }
  };

  const filteredPapers = papers.filter(filterPapers);

  // Add filter options (customize these as needed)

  const languageOptions = [
    { value: "en", label: "English" },
    { value: "zh", label: "Chinese" },
    { value: "es", label: "Spanish" },
    { value: "fr", label: "French" },
    { value: "de", label: "German" },
    { value: "ru", label: "Russian" }
  ];

  const handleRemoveFilter = (filterType: keyof SearchFilters, value?: string) => {
    if (filterType === 'years') {
      setFilters(prev => ({
        ...prev,
        years: { min: '', max: '' }
      }));
    } else if (filterType === 'documentTypes') {
      if (value) {
        setFilters(prev => ({
          ...prev,
          documentTypes: prev.documentTypes.filter(type => type !== value)
        }));
      } else {
        setFilters(prev => ({
          ...prev,
          documentTypes: []
        }));
      }
    } else {
      setFilters(prev => ({
        ...prev,
        [filterType]: prev[filterType].filter(v => v !== value)
      }));
    }
  };

  const handleYearChange = (value: [number, number]) => {
    setFilters(prev => ({
      ...prev,
      years: {
        min: String(value[0]),
        max: String(value[1])
      }
    }));
    setIsYearPopoverOpen(false);
  };

  const handleDocumentTypeFilter = (documentTypes: string[]) => {
    const newFilters = {
      ...filters,
      documentTypes
    };
    setFilters(newFilters);
    setIsDocTypePopoverOpen(false);
  };

  const handleLanguageFilter = (languages: string[]) => {
    const newFilters = {
      ...filters,
      languages
    };
    setFilters(newFilters);
    setIsLanguagePopoverOpen(false);
  };

  const SearchHelpPopover = () => {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-2 top-1/2 -translate-y-1/2 h-8 px-2 md:px-3"
          >
            <HelpCircle className="h-4 w-4 text-muted-foreground" />
            <span className="ml-2 hidden md:inline">How to Search</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[450px] p-3 search-tips-mobile"
          align="start"
        >
          <div className="space-y-3">
            <h4 className="font-medium leading-none text-center mb-3 search-tips-title">Search Tips</h4>
            <ScrollArea className="h-[200px] pr-3 search-tips-scroll">
              <div className="text-sm search-tips-content">
                <div className="space-y-3 search-tips-list">
                  <ul className="list-disc space-y-3 [&>li]:pl-2">
                    <li className="relative flex items-start gap-3 justify-between group before:absolute before:left-[-1.25rem] before:top-[0.25rem] before:content-['•'] before:text-[#448b9d] before:text-lg before:font-bold">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <code className="bg-muted px-1 rounded shrink-0">" "</code>
                          <span className="text-sm text-muted-foreground">to specify exact matching</span>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0 ml-auto hover:bg-[#448b9d] hover:text-white border-[#448b9d] text-[#448b9d]"
                        onClick={() => applySearchFormat('quotes')}
                      >
                        Apply
                      </Button>
                    </li>

                    <li className="relative flex items-start gap-3 justify-between group before:absolute before:left-[-1.25rem] before:top-[0.25rem] before:content-['•'] before:text-[#448b9d] before:text-lg before:font-bold">
                      <div className="space-y-1 flex-1">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <code className="bg-muted px-1 rounded shrink-0">property_name:"value"</code>
                            <span className="text-sm text-muted-foreground">a value for a specific property</span>
                          </div>
                          <div className="pl-4 text-sm text-muted-foreground">
                            e.g. <code className="bg-muted px-1 rounded">title:"Connecting Repositories"</code>
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0 ml-auto hover:bg-[#448b9d] hover:text-white border-[#448b9d] text-[#448b9d]"
                        onClick={() => applySearchFormat('property')}
                      >
                        Apply
                      </Button>
                    </li>

                    <li className="relative flex items-start gap-3 justify-between group before:absolute before:left-[-1.25rem] before:top-[0.25rem] before:content-['•'] before:text-[#448b9d] before:text-lg before:font-bold">
                      <div className="space-y-1 flex-1">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <code className="bg-muted px-1 rounded shrink-0">author:"value"</code>
                            <span className="text-sm text-muted-foreground">a value for a author property</span>
                          </div>
                          <div className="pl-4 text-sm text-muted-foreground">
                            e.g. <code className="bg-muted px-1 rounded">author:"John Doe"</code>
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0 ml-auto hover:bg-[#448b9d] hover:text-white border-[#448b9d] text-[#448b9d]"
                        onClick={() => applySearchFormat('author')}
                      >
                        Apply
                      </Button>
                    </li>

                    <li className="relative flex items-start gap-3 justify-between group before:absolute before:left-[-1.25rem] before:top-[0.25rem] before:content-['•'] before:text-[#448b9d] before:text-lg before:font-bold">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <code className="bg-muted px-1 rounded shrink-0">AND, OR</code>
                          <span className="text-sm text-muted-foreground">to add logic to your search</span>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0 ml-auto hover:bg-[#448b9d] hover:text-white border-[#448b9d] text-[#448b9d]"
                        onClick={() => applySearchFormat('logic')}
                      >
                        Apply
                      </Button>
                    </li>

                    <li className="relative flex items-start gap-3 justify-between group before:absolute before:left-[-1.25rem] before:top-[0.25rem] before:content-['•'] before:text-[#448b9d] before:text-lg before:font-bold">
                      <div className="space-y-1 flex-1">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <code className="bg-muted px-1 rounded shrink-0">{">="}, {"<="}, {">"}, {"<"}</code>
                            <span className="text-sm text-muted-foreground">to query on numeric fields</span>
                          </div>
                          <div className="pl-4 text-sm text-muted-foreground">
                            e.g. <code className="bg-muted px-1 rounded">year{">"}2020</code>
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0 ml-auto hover:bg-[#448b9d] hover:text-white border-[#448b9d] text-[#448b9d]"
                        onClick={() => applySearchFormat('numeric')}
                      >
                        Apply
                      </Button>
                    </li>

                    <li className="relative flex items-start gap-3 justify-between group before:absolute before:left-[-1.25rem] before:top-[0.25rem] before:content-['•'] before:text-[#448b9d] before:text-lg before:font-bold">
                      <div className="space-y-1 flex-1">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <code className="bg-muted px-1 rounded shrink-0">_exists_:"field_name"</code>
                            <span className="text-sm text-muted-foreground">to get all records that have a certain field</span>
                          </div>
                          <div className="pl-4 text-sm text-muted-foreground">
                            e.g. <code className="bg-muted px-1 rounded">_exists_:issn</code>
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0 ml-auto hover:bg-[#448b9d] hover:text-white border-[#448b9d] text-[#448b9d]"
                        onClick={() => applySearchFormat('exists')}
                      >
                        Apply
                      </Button>
                    </li>
                  </ul>
                </div>
              </div>
            </ScrollArea>
          </div>
        </PopoverContent>
      </Popover>
    );
  };

  const applySearchFormat = (format: string) => {
    let newQuery = searchQuery;
    const selectedText = searchQuery.substring(selectionStart, selectionEnd);

    switch (format) {
      case 'quotes':
        if (selectedText) {
          newQuery =
            searchQuery.substring(0, selectionStart) +
            `"${selectedText}"` +
            searchQuery.substring(selectionEnd);
        } else {
          newQuery += '" "';
        }
        break;

      case 'logic':
        if (selectedText) {
          newQuery =
            searchQuery.substring(0, selectionStart) +
            `${selectedText} AND ` +
            searchQuery.substring(selectionEnd);
        } else {
          newQuery += ' AND ';
        }
        break;

      case 'numeric':
        if (selectedText) {
          newQuery =
            searchQuery.substring(0, selectionStart) +
            `year>${selectedText}` +
            searchQuery.substring(selectionEnd);
        } else {
          newQuery += 'year>';
        }
        break;

      case 'exists':
        newQuery += ' _exists_:';
        break;

      case 'property':
        if (selectedText) {
          if (selectedText.includes(':')) {
            newQuery =
              searchQuery.substring(0, selectionStart) +
              `${selectedText.split(':')[0]}:"${selectedText.split(':')[1].trim()}"` +
              searchQuery.substring(selectionEnd);
          } else {
            newQuery =
              searchQuery.substring(0, selectionStart) +
              `title:"${selectedText}"` +
              searchQuery.substring(selectionEnd);
          }
        } else {
          newQuery += 'title:" "';
        }
        break;

      case 'author':
        if (selectedText) {
          newQuery =
            searchQuery.substring(0, selectionStart) +
            `author:"${selectedText}"` +
            searchQuery.substring(selectionEnd);
        } else {
          newQuery += 'author:" " ';
        }
        break;
    }

    setSearchQuery(newQuery);
    form.setValue("query", newQuery);
  };

  const handleSearchInputSelect = (e: React.SyntheticEvent<HTMLInputElement>) => {
    setSelectionStart(e.currentTarget.selectionStart || 0);
    setSelectionEnd(e.currentTarget.selectionEnd || 0);
  };

  const handleDownloadSummary = async () => {
    if (!summary) return;

    setIsDownloading(true);
    try {
      const response = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: summary,
          searchQuery: searchQuery
        }),
      });

      if (!response.ok) throw new Error('Failed to generate PDF');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'research-summary.pdf';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download error:', error);
      toast.error("Failed to download summary");
    } finally {
      setIsDownloading(false);
    }
  };

  // Update the validation logic
  const validateSearchQuery = (query: string) => {
    if (!query) return false;

    const validPrefixes = [
      'title:"',
      'author:"',
      'abstract:"',
      'doi:"',
      'year:',
      'publisher:"',
      '_exists_:',
    ];

    // Check if the query contains valid search syntax
    const hasValidSyntax = validPrefixes.some(prefix => query.includes(prefix));

    // Show warning if special characters exist and it's not a valid search syntax
    const hasSpecialChars = /[:]/.test(query);

    return hasSpecialChars && !hasValidSyntax;
  };

  // Update the search input handling
  useEffect(() => {
    setShowSpecialCharWarning(validateSearchQuery(searchQuery));
  }, [searchQuery]);

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
  };

  return (
    <div className="container mx-auto p-4 md:p-6"> {/* Adjusted padding for mobile */}
      {showSubscriptionDialog && <SubscriptionDialog />}
      <div className="flex justify-end mb-4">
        <ReportButton
          toolType="research-paper"
          position="inline"
          variant="pre"
        />
      </div>

      {/* Responsive header section */}
      <div className="flex flex-col items-center mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-center">Research Paper Search</h1>
        <p className="text-muted-foreground text-sm mt-2 text-center px-4">
          Search 314M+ research papers from around the world by OPEN UNIVERSITY
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={(e) => {
          e.preventDefault();
          handleSearch();
        }} className="flex flex-col md:flex-row gap-2 w-full"> {/* Stack vertically on mobile */}
          <div className="flex-1 flex flex-col md:flex-row gap-2 w-full"> {/* Stack input and select vertically on mobile */}
            <FormField
              control={form.control}
              name="query"
              render={({ field }) => (
                <div className="flex-1 relative w-full">
                  <Input
                    placeholder="Search research papers..."
                    {...field}
                    className={cn("w-full h-12 pr-32", showSpecialCharWarning && "border-yellow-500 focus:visible:ring-yellow-500"
                    )}
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      field.onChange(e.target.value);
                      handleSearchInputSelect(e);
                    }}
                  />
                  {showSpecialCharWarning && (
                    <div className="absolute top-[calc(100%+4px)] left-0 text-sm text-amber-600 flex items-center gap-2">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        className="h-4 w-4"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        />
                      </svg>
                      Using colons (:) in search may affect results.
                    </div>
                  )}
                  <SearchHelpPopover />
                </div>
              )}
            />

            <Select
              value={selectedSearchField}
              onValueChange={(value: "all" | "title" | "author") => {
                setSelectedSearchField(value);
                form.setValue("searchField", value);
                if (form.getValues("query")) {
                  // handleSearch();
                }
              }}
            >
              <SelectTrigger className="w-full md:w-[120px] h-8 md:h-12 shrink-0 hover:bg-accent hover:text-accent-foreground">
                <SelectValue>
                  {selectedSearchField === "title" ? "Title" :
                    selectedSearchField === "author" ? "Author" : "All Fields"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  value="all"
                  className="cursor-pointer hover:bg-accent hover:text-accent-foreground"
                >
                  All Fields
                </SelectItem>
                <SelectItem
                  value="title"
                  className="cursor-pointer hover:bg-accent hover:text-accent-foreground"
                >
                  Title
                </SelectItem>
                <SelectItem
                  value="author"
                  className="cursor-pointer hover:bg-accent hover:text-accent-foreground"
                >
                  Author
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="search-submit-button bg-[#438B9D] hover:bg-[#367181] text-white h-9 md:h-12"
          >
            {loading ? "Searching..." : "Search Papers"}
          </Button>
        </form>
      </Form>

      {/* Responsive filters section */}
      <div className="my-4 md:my-6 flex flex-col md:flex-row gap-2 md:gap-4 items-start md:items-center">
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <Popover open={isYearPopoverOpen} onOpenChange={setIsYearPopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full md:w-auto h-8 px-4">
                Publication Year {filters.years.min && filters.years.max ?
                  `(${filters.years.min}-${filters.years.max})` : ''}
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-4">
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex-1">
                    <UILabel>From</UILabel>
                    <Input
                      type="number"
                      min={1900}
                      max={new Date().getFullYear()}
                      value={filters.years.min}
                      onChange={(e) => {
                        const newValue = e.target.value;
                        setFilters(prev => ({
                          ...prev,
                          years: { ...prev.years, min: newValue }
                        }));
                      }}
                      placeholder="Min year"
                    />
                  </div>
                  <div className="flex-1">
                    <UILabel>To</UILabel>
                    <Input
                      type="number"
                      min={1900}
                      max={new Date().getFullYear()}
                      value={filters.years.max}
                      onChange={(e) => {
                        const newValue = e.target.value;
                        setFilters(prev => ({
                          ...prev,
                          years: { ...prev.years, max: newValue }
                        }));
                      }}
                      placeholder="Max year"
                    />
                  </div>
                </div>
                <Button
                  className="w-full"
                  onClick={() => setIsYearPopoverOpen(false)}
                >
                  Apply
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          <Popover open={isDocTypePopoverOpen} onOpenChange={setIsDocTypePopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full md:w-auto h-8 px-4">
                Document Type <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-2">
              <div className="space-y-2">
                {documentTypeOptions.map((type) => (
                  <div key={type.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={type.value}
                      checked={filters.documentTypes.includes(type.value)}
                      onCheckedChange={(checked) => {
                        const newTypes = checked
                          ? [...filters.documentTypes, type.value]
                          : filters.documentTypes.filter(t => t !== type.value);
                        handleDocumentTypeFilter(newTypes);
                        setIsDocTypePopoverOpen(false);
                      }}
                    />
                    <UILabel htmlFor={type.value}>{type.label}</UILabel>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <Popover open={isLanguagePopoverOpen} onOpenChange={setIsLanguagePopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full md:w-auto h-8 px-4">
                Language <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-2">
              <div className="space-y-2">
                {languageOptions.map((lang) => (
                  <div key={lang.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={lang.value}
                      checked={filters.languages.includes(lang.value)}
                      onCheckedChange={(checked) => {
                        const newLanguages = checked
                          ? [...filters.languages, lang.value]
                          : filters.languages.filter(l => l !== lang.value);
                        handleLanguageFilter(newLanguages);
                        setIsLanguagePopoverOpen(false);
                      }}
                    />
                    <UILabel htmlFor={lang.value}>{lang.label}</UILabel>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex flex-wrap gap-2 w-full md:w-auto md:ml-auto">
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-full md:w-[200px] hover:bg-accent hover:text-accent-foreground">
              <SelectValue placeholder="Filter by date" />
            </SelectTrigger>
            <SelectContent>
              {[
                { value: "all", label: "Sort by All" },
                { value: "recent", label: "Recent (6 months)" },
                { value: "1y", label: "1 Year Ago" },
                { value: "5y", label: "5 Years Ago" }
              ].map(option => (
                <SelectItem
                  key={option.value}
                  value={option.value}
                  className="cursor-pointer hover:bg-accent hover:text-accent-foreground"
                >
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {Object.entries(filters).map(([key, value]) => {
          if (key === 'years') {
            const years = value as { min: string; max: string; };
            if (years.min && years.max) {
              return (
                <Badge key="years" variant="outline" className="px-2 py-1 text-sm">
                  Years: {years.min}-{years.max}
                  <X
                    className="ml-2 h-3 w-3 cursor-pointer"
                    onClick={() => handleRemoveFilter('years')}
                  />
                </Badge>
              );
            }
            return null;
          }

          if (key === 'languages') {
            return (value as string[]).map((val: string) => (
              <Badge key={`${key}-${val}`} variant="outline" className="px-2 py-1 text-sm">
                {languageOptions.find(lang => lang.value === val)?.label || val}
                <X
                  className="ml-2 h-3 w-3 cursor-pointer"
                  onClick={() => handleRemoveFilter(key as keyof SearchFilters, val)}
                />
              </Badge>
            ));
          }

          if (key === 'documentTypes') {
            return (value as string[]).map((val: string) => (
              <Badge key={`${key}-${val}`} variant="outline" className="px-2 py-1 text-sm">
                Document Type: {documentTypeOptions.find(t => t.value === val)?.label || val}
                <X
                  className="ml-2 h-3 w-3 cursor-pointer"
                  onClick={() => handleRemoveFilter(key as keyof SearchFilters, val)}
                />
              </Badge>
            ));
          }

          return (value as string[]).map((val: string) => (
            <Badge key={`${key}-${val}`} variant="outline" className="px-2 py-1 text-sm">
              {key}: {val}
              <X
                className="ml-2 h-3 w-3 cursor-pointer"
                onClick={() => handleRemoveFilter(key as keyof SearchFilters, val)}
              />
            </Badge>
          ));
        })}
      </div>

      {summaryMutation.isPending && (
        <div className="mt-6 p-4 bg-muted/50 rounded-lg flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Generating research summary...</span>
        </div>
      )}

      {summary && (
        <Card className="mt-6 p-4 md:p-6">
          <div className="mt-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
              <h2 className="text-xl md:text-2xl font-bold">Research Papers Summary</h2>
              <div className="flex flex-wrap gap-2 w-full md:w-auto">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full md:w-auto flex items-center gap-1">
                      <Settings className="h-4 w-4" />
                      Summary Sections
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0" align="end">
                    <ScrollArea className="h-64">
                      <div className="space-y-4 p-4">
                        {[
                          {
                            id: "overview",
                            label: "Overview",
                            description: "Main topics, research importance, key problems"
                          },
                          {
                            id: "keyfindings",
                            label: "Key Findings",
                            description: "Important discoveries, main results, applications"
                          },
                          {
                            id: "methods",
                            label: "Research Methods",
                            description: "Techniques used, tools, data sources"
                          },
                          {
                            id: "impact",
                            label: "Significance & Impact",
                            description: "Real-world applications, societal benefits"
                          },
                          {
                            id: "connections",
                            label: "Paper Connections",
                            description: "Common themes, contradictions, complementarity"
                          },
                          {
                            id: "conclusion",
                            label: "Conclusion",
                            description: "Key points, future research, final thoughts"
                          }
                        ].map((section) => (
                          <div key={section.id} className="flex items-start space-x-2">
                            <Checkbox
                              id={section.id}
                              checked={selectedSections.has(section.id)}
                              onCheckedChange={(checked) => {
                                const newSections = new Set(selectedSections);
                                checked ?
                                  newSections.add(section.id) :
                                  newSections.delete(section.id);
                                setSelectedSections(newSections);
                              }}
                            />
                            <UILabel htmlFor={section.id} className="flex flex-col">
                              <span className="text-sm font-medium">{section.label}</span>
                              <span className="text-xs text-muted-foreground">
                                {section.description}
                              </span>
                            </UILabel>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </PopoverContent>
                </Popover>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => summaryMutation.mutate(papers.slice(0, MAX_PAPERS_SUMMARY), {
                    onSuccess: (summary) => {
                      if (summary) setSummary(summary);
                    }
                  })}
                  disabled={summaryMutation.isPending}
                  className="w-full md:w-auto"
                >
                  {summaryMutation.isPending ?
                    <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Regenerate Summary
                </Button>
                <Button
                  onClick={handleDownloadSummary}
                  variant="outline"
                  size="sm"
                  className="w-full md:w-auto flex items-center gap-1"
                  disabled={isDownloading}
                >
                  {isDownloading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  {isDownloading ? "Downloading..." : "Download PDF"}
                </Button>
              </div>
            </div>
            <div
              className="prose prose-sm max-w-none summary-content overflow-x-auto"
              dangerouslySetInnerHTML={{ __html: summary }}
            />
          </div>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center items-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : hasSearched && filteredPapers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <FileText className="h-12 w-12 text-gray-400 mb-4" />
          <p className="text-lg font-medium text-gray-900">No papers found</p>
          <p className="text-sm text-gray-500">Try adjusting your search or filters</p>
        </div>
      ) : filteredPapers.length > 0 && (
        <div className="grid gap-4 mt-6">
          {filteredPapers.map((paper, index) => (
            <div
              key={paper.id}
              ref={index === filteredPapers.length - 1 ? lastPaperElementRef : null}
            >
              <Card className="p-4 md:p-6 mb-4 group hover:shadow-sm transition-shadow">
                <div className="flex flex-col md:flex-row items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <h3 className="text-base md:text-lg font-semibold text-foreground">{paper.title}</h3>
                    <p className="text-xs md:text-sm text-muted-foreground">
                      Authors: {paper.authors.join(", ")}
                    </p>
                    {paper.publishedDate && (
                      <p className="text-xs md:text-sm text-gray-600">
                        Published Date: {new Date(paper.publishedDate).toLocaleDateString()}
                      </p>
                    )}
                    {!paper.publishedDate && paper.year && (
                      <p className="text-xs md:text-sm text-gray-600">
                        Publication Year: {paper.year}
                      </p>
                    )}
                    {paper.venue && (
                      <p className="text-xs md:text-sm text-gray-600">
                        Published in: {paper.venue}
                      </p>
                    )}
                    {paper.language && (
                      <p className="text-xs md:text-sm text-gray-600">
                        Language: {languageOptions.find(l => l.value === paper.language)?.label}
                      </p>
                    )}
                    {paper.documentType && (
                      <span className="inline-block text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full mt-2">
                        {{
                          'theses': 'Thesis',
                          'journal_articles': 'Research',
                          'presentations': 'Slides',
                          'other': 'Unknown'
                        }[paper.documentType] || paper.documentType}
                      </span>
                    )}
                    <p className="text-sm mt-2 line-clamp-3 md:line-clamp-none">{paper.abstract}</p>
                  </div>
                  {paper.downloadUrl && (
                    <a
                      href={paper.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 flex items-center gap-2 p-2 md:p-4 bg-card-foreground/5 hover:bg-card-foreground/10 border border-border rounded-md transition-all group/button w-full md:w-32 md:h-32 md:flex-col md:justify-center"
                    >
                      <div className="relative w-8 h-8 md:w-full md:h-full flex items-center justify-center">
                        <div className="absolute inset-0 bg-primary/10 rounded-md transition-colors group-hover/button:bg-primary/20" />
                        <Image
                          src="/file.svg"
                          width={64}
                          height={64}
                          alt="Download document"
                          className="text-primary relative z-10 w-6 h-6 md:w-12 md:h-12 transition-transform group-hover/button:scale-110"
                        />
                      </div>
                      <span className="text-primary font-medium text-sm text-center leading-tight">
                        Get document
                      </span>
                    </a>
                  )}
                </div>
              </Card>
            </div>
          ))}
        </div>
      )}

      {isLoadingMore && (
        <div className="flex justify-center py-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {noMoreResults && loadedCount > 0 && (
        <div className="text-center py-4 text-muted-foreground">
          No more papers to load
        </div>
      )}

      {loadedCount > 0 && (
        <div className="text-center text-sm text-muted-foreground mt-4">
          Showing {loadedCount} of {Math.min(totalResults, 5000).toLocaleString()} results
          {totalBatches > 0 && ` • Page ${batchNumber} of ${Math.min(Math.ceil(totalResults / 50), 100)}`}
          {totalResults > 5000 && (
            <div className="text-xs text-muted-foreground mt-1">
              Note: Results are limited to first 5000 papers due to API constraints
            </div>
          )}
        </div>
      )}
    </div>
  );
}