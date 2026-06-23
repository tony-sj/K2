"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { createFacility, deleteFacility } from "@/app/actions";
import type { Facility } from "@/lib/database.types";

type AdminFacilityManagerProps = {
  facilities: Facility[];
  onRefresh: () => Promise<void>;
};

export function AdminFacilityManager({
  facilities,
  onRefresh
}: AdminFacilityManagerProps) {
  const [name, setName] = useState("");
  const [notice, setNotice] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleCreate = () => {
    startTransition(async () => {
      const result = await createFacility({ name });
      setNotice(result.message);

      if (!result.ok) {
        window.alert(result.message);
        return;
      }

      setName("");
      await onRefresh();
    });
  };

  const handleDelete = (facilityId: number) => {
    startTransition(async () => {
      const result = await deleteFacility({ facilityId });
      setNotice(result.message);

      if (!result.ok) {
        window.alert(result.message);
        return;
      }

      await onRefresh();
    });
  };

  return (
    <section className="border-b border-zinc-100 px-5 py-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-zinc-900">시설 관리</p>
          <p className="mt-1 text-xs text-zinc-500">관리자 계정에서만 추가와 삭제가 가능합니다.</p>
        </div>
      </div>

      <div className="flex gap-2">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="새 시설명"
          className="h-11 flex-1 rounded-lg border border-zinc-200 px-3 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-teal-700"
        />
        <button
          type="button"
          disabled={isPending}
          onClick={handleCreate}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-zinc-950 px-4 text-sm font-semibold text-white disabled:bg-zinc-300"
        >
          <Plus aria-hidden="true" className="h-4 w-4" />
          추가
        </button>
      </div>

      {notice ? (
        <p className="mt-3 rounded-lg bg-zinc-100 px-3 py-2 text-[13px] font-medium text-zinc-700">
          {notice}
        </p>
      ) : null}

      <div className="mt-3 space-y-2">
        {facilities.map((facility) => (
          <div
            key={facility.id}
            className="flex items-center justify-between rounded-lg border border-zinc-200 px-3 py-3"
          >
            <span className="text-sm font-medium text-zinc-900">{facility.name}</span>
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleDelete(facility.id)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 text-zinc-500 disabled:text-zinc-300"
              title={`${facility.name} 삭제`}
            >
              <Trash2 aria-hidden="true" className="h-4 w-4" />
              <span className="sr-only">{facility.name} 삭제</span>
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
