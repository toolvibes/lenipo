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





T = TypeVar("T", bound="SavePageTemplateRequest")



@_attrs_define
class SavePageTemplateRequest:
    """ 
        Attributes:
            name (str):
            content (RichText):
            description (str | Unset):  Default: ''.
            title (str | Unset):  Default: ''.
     """

    name: str
    content: RichText
    description: str | Unset = ''
    title: str | Unset = ''
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.rich_text import RichText # noqa: PLC0415
        name = self.name

        content = self.content.to_dict()

        description = self.description

        title = self.title


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "name": name,
            "content": content,
        })
        if description is not UNSET:
            field_dict["description"] = description
        if title is not UNSET:
            field_dict["title"] = title

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.rich_text import RichText # noqa: PLC0415
        d = dict(src_dict)
        name = d.pop("name")

        content = RichText.from_dict(d.pop("content"))




        description = d.pop("description", UNSET)

        title = d.pop("title", UNSET)

        save_page_template_request = cls(
            name=name,
            content=content,
            description=description,
            title=title,
        )


        save_page_template_request.additional_properties = d
        return save_page_template_request

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
