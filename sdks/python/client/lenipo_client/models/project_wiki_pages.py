from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast






T = TypeVar("T", bound="ProjectWikiPages")



@_attrs_define
class ProjectWikiPages:
    """ 
        Attributes:
            space_key (None | str):
            retro_on_sprint_end (bool):
            report_on_sprint_end (bool):
            notes_on_release (bool):
     """

    space_key: None | str
    retro_on_sprint_end: bool
    report_on_sprint_end: bool
    notes_on_release: bool





    def to_dict(self) -> dict[str, Any]:
        space_key: None | str
        space_key = self.space_key

        retro_on_sprint_end = self.retro_on_sprint_end

        report_on_sprint_end = self.report_on_sprint_end

        notes_on_release = self.notes_on_release


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "spaceKey": space_key,
            "retroOnSprintEnd": retro_on_sprint_end,
            "reportOnSprintEnd": report_on_sprint_end,
            "notesOnRelease": notes_on_release,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        def _parse_space_key(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        space_key = _parse_space_key(d.pop("spaceKey"))


        retro_on_sprint_end = d.pop("retroOnSprintEnd")

        report_on_sprint_end = d.pop("reportOnSprintEnd")

        notes_on_release = d.pop("notesOnRelease")

        project_wiki_pages = cls(
            space_key=space_key,
            retro_on_sprint_end=retro_on_sprint_end,
            report_on_sprint_end=report_on_sprint_end,
            notes_on_release=notes_on_release,
        )

        return project_wiki_pages

