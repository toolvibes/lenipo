from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset
from typing import cast






T = TypeVar("T", bound="PrintTemplateInput")



@_attrs_define
class PrintTemplateInput:
    """ 
        Attributes:
            name (str):
            title_page (bool | Unset):  Default: True.
            logo (None | str | Unset):
            subtitle (str | Unset):  Default: ''.
            header (str | Unset):  Default: '{{space}} · {{title}}'.
            footer (str | Unset):  Default: '{{date}} · {{page}} / {{pages}}'.
            css (str | Unset):  Default: ''.
            is_default (bool | Unset):  Default: False.
     """

    name: str
    title_page: bool | Unset = True
    logo: None | str | Unset = UNSET
    subtitle: str | Unset = ''
    header: str | Unset = '{{space}} · {{title}}'
    footer: str | Unset = '{{date}} · {{page}} / {{pages}}'
    css: str | Unset = ''
    is_default: bool | Unset = False
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        name = self.name

        title_page = self.title_page

        logo: None | str | Unset
        if isinstance(self.logo, Unset):
            logo = UNSET
        else:
            logo = self.logo

        subtitle = self.subtitle

        header = self.header

        footer = self.footer

        css = self.css

        is_default = self.is_default


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "name": name,
        })
        if title_page is not UNSET:
            field_dict["titlePage"] = title_page
        if logo is not UNSET:
            field_dict["logo"] = logo
        if subtitle is not UNSET:
            field_dict["subtitle"] = subtitle
        if header is not UNSET:
            field_dict["header"] = header
        if footer is not UNSET:
            field_dict["footer"] = footer
        if css is not UNSET:
            field_dict["css"] = css
        if is_default is not UNSET:
            field_dict["isDefault"] = is_default

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        name = d.pop("name")

        title_page = d.pop("titlePage", UNSET)

        def _parse_logo(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        logo = _parse_logo(d.pop("logo", UNSET))


        subtitle = d.pop("subtitle", UNSET)

        header = d.pop("header", UNSET)

        footer = d.pop("footer", UNSET)

        css = d.pop("css", UNSET)

        is_default = d.pop("isDefault", UNSET)

        print_template_input = cls(
            name=name,
            title_page=title_page,
            logo=logo,
            subtitle=subtitle,
            header=header,
            footer=footer,
            css=css,
            is_default=is_default,
        )


        print_template_input.additional_properties = d
        return print_template_input

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
