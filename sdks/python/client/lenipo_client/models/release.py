from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.issue_summary import IssueSummary
  from ..models.release_notes_page_type_0 import ReleaseNotesPageType0
  from ..models.release_progress import ReleaseProgress
  from ..models.release_warning import ReleaseWarning
  from ..models.version import Version





T = TypeVar("T", bound="Release")



@_attrs_define
class Release:
    """ 
        Attributes:
            version (Version):
            progress (ReleaseProgress):
            todo (list[IssueSummary]):
            in_progress (list[IssueSummary]):
            done (list[IssueSummary]):
            warnings (list[ReleaseWarning]):
            notes_page (None | ReleaseNotesPageType0):
            can_edit (bool):
     """

    version: Version
    progress: ReleaseProgress
    todo: list[IssueSummary]
    in_progress: list[IssueSummary]
    done: list[IssueSummary]
    warnings: list[ReleaseWarning]
    notes_page: None | ReleaseNotesPageType0
    can_edit: bool





    def to_dict(self) -> dict[str, Any]:
        from ..models.issue_summary import IssueSummary # noqa: PLC0415
        from ..models.release_notes_page_type_0 import ReleaseNotesPageType0 # noqa: PLC0415
        from ..models.release_progress import ReleaseProgress # noqa: PLC0415
        from ..models.release_warning import ReleaseWarning # noqa: PLC0415
        from ..models.version import Version # noqa: PLC0415
        version = self.version.to_dict()

        progress = self.progress.to_dict()

        todo = []
        for todo_item_data in self.todo:
            todo_item = todo_item_data.to_dict()
            todo.append(todo_item)



        in_progress = []
        for in_progress_item_data in self.in_progress:
            in_progress_item = in_progress_item_data.to_dict()
            in_progress.append(in_progress_item)



        done = []
        for done_item_data in self.done:
            done_item = done_item_data.to_dict()
            done.append(done_item)



        warnings = []
        for warnings_item_data in self.warnings:
            warnings_item = warnings_item_data.to_dict()
            warnings.append(warnings_item)



        notes_page: dict[str, Any] | None
        if isinstance(self.notes_page, ReleaseNotesPageType0):
            notes_page = self.notes_page.to_dict()
        else:
            notes_page = self.notes_page

        can_edit = self.can_edit


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "version": version,
            "progress": progress,
            "todo": todo,
            "inProgress": in_progress,
            "done": done,
            "warnings": warnings,
            "notesPage": notes_page,
            "canEdit": can_edit,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.issue_summary import IssueSummary # noqa: PLC0415
        from ..models.release_notes_page_type_0 import ReleaseNotesPageType0 # noqa: PLC0415
        from ..models.release_progress import ReleaseProgress # noqa: PLC0415
        from ..models.release_warning import ReleaseWarning # noqa: PLC0415
        from ..models.version import Version # noqa: PLC0415
        d = dict(src_dict)
        version = Version.from_dict(d.pop("version"))




        progress = ReleaseProgress.from_dict(d.pop("progress"))




        todo = []
        _todo = d.pop("todo")
        for todo_item_data in (_todo):
            todo_item = IssueSummary.from_dict(todo_item_data)



            todo.append(todo_item)


        in_progress = []
        _in_progress = d.pop("inProgress")
        for in_progress_item_data in (_in_progress):
            in_progress_item = IssueSummary.from_dict(in_progress_item_data)



            in_progress.append(in_progress_item)


        done = []
        _done = d.pop("done")
        for done_item_data in (_done):
            done_item = IssueSummary.from_dict(done_item_data)



            done.append(done_item)


        warnings = []
        _warnings = d.pop("warnings")
        for warnings_item_data in (_warnings):
            warnings_item = ReleaseWarning.from_dict(warnings_item_data)



            warnings.append(warnings_item)


        def _parse_notes_page(data: object) -> None | ReleaseNotesPageType0:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                notes_page_type_0 = ReleaseNotesPageType0.from_dict(data)



                return notes_page_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | ReleaseNotesPageType0, data)

        notes_page = _parse_notes_page(d.pop("notesPage"))


        can_edit = d.pop("canEdit")

        release = cls(
            version=version,
            progress=progress,
            todo=todo,
            in_progress=in_progress,
            done=done,
            warnings=warnings,
            notes_page=notes_page,
            can_edit=can_edit,
        )

        return release

