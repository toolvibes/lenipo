from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.diff_block_content_type import DiffBlockContentType
from ..types import UNSET, Unset
from typing import cast






T = TypeVar("T", bound="DiffBlockContent")



@_attrs_define
class DiffBlockContent:
    """ 
        Attributes:
            type_ (DiffBlockContentType):
            text (str):
            depth (int):
            level (int | Unset):
            checked (bool | Unset):
            cells (list[str] | Unset):
            header (bool | Unset):
            attachment_id (str | Unset):
     """

    type_: DiffBlockContentType
    text: str
    depth: int
    level: int | Unset = UNSET
    checked: bool | Unset = UNSET
    cells: list[str] | Unset = UNSET
    header: bool | Unset = UNSET
    attachment_id: str | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        type_ = self.type_.value

        text = self.text

        depth = self.depth

        level = self.level

        checked = self.checked

        cells: list[str] | Unset = UNSET
        if not isinstance(self.cells, Unset):
            cells = self.cells



        header = self.header

        attachment_id = self.attachment_id


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "type": type_,
            "text": text,
            "depth": depth,
        })
        if level is not UNSET:
            field_dict["level"] = level
        if checked is not UNSET:
            field_dict["checked"] = checked
        if cells is not UNSET:
            field_dict["cells"] = cells
        if header is not UNSET:
            field_dict["header"] = header
        if attachment_id is not UNSET:
            field_dict["attachmentId"] = attachment_id

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        type_ = DiffBlockContentType(d.pop("type"))




        text = d.pop("text")

        depth = d.pop("depth")

        level = d.pop("level", UNSET)

        checked = d.pop("checked", UNSET)

        cells = cast(list[str], d.pop("cells", UNSET))


        header = d.pop("header", UNSET)

        attachment_id = d.pop("attachmentId", UNSET)

        diff_block_content = cls(
            type_=type_,
            text=text,
            depth=depth,
            level=level,
            checked=checked,
            cells=cells,
            header=header,
            attachment_id=attachment_id,
        )

        return diff_block_content

