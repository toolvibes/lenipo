from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.page_template_summary_kind import PageTemplateSummaryKind
from typing import cast
from uuid import UUID
import datetime






T = TypeVar("T", bound="PageTemplateSummary")



@_attrs_define
class PageTemplateSummary:
    """ 
        Attributes:
            ref (str):
            kind (PageTemplateSummaryKind):
            id (None | UUID):
            name (str):
            description (str):
            title (str):
            space_key (None | str):
            updated_at (datetime.datetime | None):
            inputs (list[str]):
     """

    ref: str
    kind: PageTemplateSummaryKind
    id: None | UUID
    name: str
    description: str
    title: str
    space_key: None | str
    updated_at: datetime.datetime | None
    inputs: list[str]





    def to_dict(self) -> dict[str, Any]:
        ref = self.ref

        kind = self.kind.value

        id: None | str
        if isinstance(self.id, UUID):
            id = str(self.id)
        else:
            id = self.id

        name = self.name

        description = self.description

        title = self.title

        space_key: None | str
        space_key = self.space_key

        updated_at: None | str
        if isinstance(self.updated_at, datetime.datetime):
            updated_at = self.updated_at.isoformat()
        else:
            updated_at = self.updated_at

        inputs = self.inputs




        field_dict: dict[str, Any] = {}

        field_dict.update({
            "ref": ref,
            "kind": kind,
            "id": id,
            "name": name,
            "description": description,
            "title": title,
            "spaceKey": space_key,
            "updatedAt": updated_at,
            "inputs": inputs,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        ref = d.pop("ref")

        kind = PageTemplateSummaryKind(d.pop("kind"))




        def _parse_id(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                id_type_0 = UUID(data)



                return id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        id = _parse_id(d.pop("id"))


        name = d.pop("name")

        description = d.pop("description")

        title = d.pop("title")

        def _parse_space_key(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        space_key = _parse_space_key(d.pop("spaceKey"))


        def _parse_updated_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                updated_at_type_0 = datetime.datetime.fromisoformat(data)



                return updated_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        updated_at = _parse_updated_at(d.pop("updatedAt"))


        inputs = cast(list[str], d.pop("inputs"))


        page_template_summary = cls(
            ref=ref,
            kind=kind,
            id=id,
            name=name,
            description=description,
            title=title,
            space_key=space_key,
            updated_at=updated_at,
            inputs=inputs,
        )

        return page_template_summary

