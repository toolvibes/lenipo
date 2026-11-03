from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset
from typing import cast

if TYPE_CHECKING:
  from ..models.rich_text import RichText





T = TypeVar("T", bound="PublishPageRequest")



@_attrs_define
class PublishPageRequest:
    """ 
        Attributes:
            title (str):
            content (RichText):
            comment (str | Unset):  Default: ''.
     """

    title: str
    content: RichText
    comment: str | Unset = ''
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.rich_text import RichText # noqa: PLC0415
        title = self.title

        content = self.content.to_dict()

        comment = self.comment


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "title": title,
            "content": content,
        })
        if comment is not UNSET:
            field_dict["comment"] = comment

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.rich_text import RichText # noqa: PLC0415
        d = dict(src_dict)
        title = d.pop("title")

        content = RichText.from_dict(d.pop("content"))




        comment = d.pop("comment", UNSET)

        publish_page_request = cls(
            title=title,
            content=content,
            comment=comment,
        )


        publish_page_request.additional_properties = d
        return publish_page_request

    @property
    def additional_keys(self) -> list[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> Any:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
