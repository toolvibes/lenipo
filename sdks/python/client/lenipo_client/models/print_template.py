from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID
import datetime






T = TypeVar("T", bound="PrintTemplate")



@_attrs_define
class PrintTemplate:
    """ 
        Attributes:
            name (str):
            title_page (bool):  Default: True.
            logo (None | str):
            subtitle (str):  Default: ''.
            header (str):  Default: '{{space}} · {{title}}'.
            footer (str):  Default: '{{date}} · {{page}} / {{pages}}'.
            css (str):  Default: ''.
            is_default (bool):  Default: False.
            id (UUID):
            updated_at (datetime.datetime):
     """

    name: str
    logo: None | str
    id: UUID
    updated_at: datetime.datetime
    title_page: bool = True
    subtitle: str = ''
    header: str = '{{space}} · {{title}}'
    footer: str = '{{date}} · {{page}} / {{pages}}'
    css: str = ''
    is_default: bool = False





    def to_dict(self) -> dict[str, Any]:
        name = self.name

        title_page = self.title_page

        logo: None | str
        logo = self.logo

        subtitle = self.subtitle

        header = self.header

        footer = self.footer

        css = self.css

        is_default = self.is_default

        id = str(self.id)

        updated_at = self.updated_at.isoformat()


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "name": name,
            "titlePage": title_page,
            "logo": logo,
            "subtitle": subtitle,
            "header": header,
            "footer": footer,
            "css": css,
            "isDefault": is_default,
            "id": id,
            "updatedAt": updated_at,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        name = d.pop("name")

        title_page = d.pop("titlePage")

        def _parse_logo(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        logo = _parse_logo(d.pop("logo"))


        subtitle = d.pop("subtitle")

        header = d.pop("header")

        footer = d.pop("footer")

        css = d.pop("css")

        is_default = d.pop("isDefault")

        id = UUID(d.pop("id"))




        updated_at = datetime.datetime.fromisoformat(d.pop("updatedAt"))




        print_template = cls(
            name=name,
            title_page=title_page,
            logo=logo,
            subtitle=subtitle,
            header=header,
            footer=footer,
            css=css,
            is_default=is_default,
            id=id,
            updated_at=updated_at,
        )

        return print_template

