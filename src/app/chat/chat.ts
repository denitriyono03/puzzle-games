import { AfterViewChecked, Component, ElementRef, ViewChild, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ConfigService } from '../config/config.service';
import { ChatService } from './chat.service';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatButtonModule, MatIconModule, MatCardModule, MatChipsModule,
    MatFormFieldModule, MatInputModule, MatTooltipModule,
  ],
  templateUrl: './chat.html',
  styleUrl: './chat.scss',
})
export class Chat implements AfterViewChecked {
  protected config = inject(ConfigService);
  protected chat = inject(ChatService);
  private router = inject(Router);
  private sanitizer = inject(DomSanitizer);

  open = signal(false);
  showSettings = signal(false);
  draft = '';
  keyDraft = '';
  keySaved = false;
  keySavedNote = signal(false);

  @ViewChild('messagesEl') private messagesEl?: ElementRef<HTMLElement>;

  constructor() {
    this.keySaved = this.chat.hasStoredKey();
  }

  ngAfterViewChecked(): void {
    this.scrollToBottom();
  }

  toggle(): void {
    this.open.update((v) => !v);
    if (this.open()) this.scrollToBottom();
  }

  close(): void {
    this.open.set(false);
    this.showSettings.set(false);
  }

  send(): void {
    const text = this.draft.trim();
    if (!text) return;
    this.draft = '';
    void this.chat.send(text);
  }

  sendQuick(reply: string): void {
    void this.chat.send(reply);
  }

  clear(): void {
    this.chat.clearHistory();
  }

  toggleSettings(): void {
    this.showSettings.update((v) => !v);
    if (this.showSettings()) {
      this.keyDraft = '';
      this.keySaved = this.chat.hasStoredKey();
    }
  }

  saveKey(): void {
    this.chat.saveGeminiKey(this.keyDraft);
    this.keyDraft = '';
    this.keySaved = this.chat.hasStoredKey();
    this.keySavedNote.set(true);
    setTimeout(() => this.keySavedNote.set(false), 2500);
  }

  removeKey(): void {
    this.chat.saveGeminiKey('');
    this.keySaved = false;
  }

  /** Link [label](route:...) di jawaban bot -> anchor; klik dinavigasi via Router. */
  render(text: string): SafeHtml {
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const withLinks = escaped.replace(
      /\[([^\]]+)\]\(route:([^)]+)\)/g,
      (_m, label: string, route: string) =>
        `<a href="#" class="chat-link" data-route="${route}">${label}</a>`,
    );
    return this.sanitizer.bypassSecurityTrustHtml(withLinks.replace(/\n/g, '<br>'));
  }

  onMessagesClick(event: MouseEvent): void {
    const target = (event.target as HTMLElement).closest('[data-route]') as HTMLElement | null;
    if (!target) return;
    event.preventDefault();
    const route = target.getAttribute('data-route') ?? '/';
    const [path, query] = route.split('?');
    const queryParams: Record<string, string> = {};
    if (query) {
      for (const pair of query.split('&')) {
        const [k, v] = pair.split('=');
        if (k) queryParams[decodeURIComponent(k)] = decodeURIComponent(v ?? '');
      }
    }
    void this.router.navigate([path], { queryParams });
  }

  fmtTime(ts: number): string {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  private scrollToBottom(): void {
    const el = this.messagesEl?.nativeElement;
    if (el) el.scrollTop = el.scrollHeight;
  }
}
